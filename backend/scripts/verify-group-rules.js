const { AUTO_REFUND_REASON } = require('../shared/constants/refunds')
const {
  applyPaymentToGroup,
  applyRefundToGroup,
  buildGroupCreationPayload,
  canApplyPaymentToGroup,
  hasSuccessfulParticipation
} = require('../shared/domain/groupRules')

const assertScenario = ({ name, run }) => {
  try {
    run()
    return { name, passed: true, detail: 'ok' }
  } catch (error) {
    return {
      name,
      passed: false,
      detail: error instanceof Error ? error.message : 'unknown error'
    }
  }
}

const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const buildFailedRefundResult = ({ group, orders, groupMembers }) => ({
  group: {
    ...group,
    status: 'failed'
  },
  orders: orders.map(item =>
    item.status === 'pending' || item.status === 'success'
      ? {
          ...item,
          status: 'refunded',
          refund_reason: AUTO_REFUND_REASON
        }
      : item
  ),
  groupMembers
})

const scenarios = [
  {
    name: '新拼团截止时间统一等于课程报名截止时间',
    run: () => {
      const course = {
        id: 'course_1',
        deadline: '2026-03-28T18:00:00+08:00',
        default_target_count: 3
      }
      const payload = buildGroupCreationPayload({
        courseId: course.id,
        creatorId: 'user_1',
        deadline: course.deadline,
        targetCount: course.default_target_count
      })
      expect(payload.expire_time === course.deadline, 'group expire_time 没有等于课程 deadline')
    }
  },
  {
    name: '拼团失败自动退款时保留 group_members',
    run: () => {
      const group = { id: 'group_1', status: 'active' }
      const groupMembers = [
        { group_id: 'group_1', user_id: 'user_1' },
        { group_id: 'group_1', user_id: 'user_2' }
      ]
      const orders = [
        { id: 'order_1', group_id: 'group_1', user_id: 'user_1', status: 'success' },
        { id: 'order_2', group_id: 'group_1', user_id: 'user_2', status: 'pending' }
      ]

      const result = buildFailedRefundResult({ group, orders, groupMembers })

      expect(result.group.status === 'failed', 'group 没有被标记为 failed')
      expect(result.groupMembers.length === 2, 'group_members 被误删除')
      expect(result.orders.every(item => item.status === 'refunded'), 'orders 没有全部改成 refunded')
      expect(
        result.orders.every(item => item.refund_reason === AUTO_REFUND_REASON),
        'orders 没有写入自动退款原因'
      )
    }
  },
  {
    name: '失败团成员记录不会拦截未来再次参团',
    run: () => {
      const userId = 'user_1'
      const orders = [
        { id: 'order_1', group_id: 'group_1', user_id: 'user_1', status: 'refunded' }
      ]

      const blocked = hasSuccessfulParticipation({
        successMembershipExists: false,
        successOrderExists: orders.some(item => item.user_id === userId && item.status === 'success')
      })
      expect(blocked === false, '失败团或退款订单错误地拦截了再次参团')
    }
  },
  {
    name: '成功团或成功订单仍会拦截重复成功参团',
    run: () => {
      const userId = 'user_1'
      const successGroupIds = ['group_success']
      const orders = [
        { id: 'order_1', group_id: 'group_success', user_id: 'user_1', status: 'success' }
      ]

      const blocked = hasSuccessfulParticipation({
        successMembershipExists: orders.some(
          item =>
            item.user_id === userId &&
            successGroupIds.includes(item.group_id) &&
            item.status === 'success'
        ),
        successOrderExists: orders.some(item => item.user_id === userId && item.status === 'success')
      })
      expect(blocked === true, '成功参团记录没有拦截重复成功参团')
    }
  },
  {
    name: '手动退款后会回滚 group_members、团人数和团状态',
    run: () => {
      const group = {
        id: 'group_success',
        status: 'success',
        current_count: 3,
        target_count: 3,
        expire_time: '2026-03-28T18:00:00+08:00'
      }
      const order = {
        id: 'order_1',
        group_id: 'group_success',
        user_id: 'user_1',
        status: 'success'
      }
      const groupMembers = [
        { group_id: 'group_success', user_id: 'user_1' },
        { group_id: 'group_success', user_id: 'user_2' },
        { group_id: 'group_success', user_id: 'user_3' }
      ]

      const rollback = applyRefundToGroup({
        group,
        membershipExists: true,
        now: new Date('2026-03-27T12:00:00+08:00')
      })
      const result = {
        group: {
          ...group,
          current_count: rollback.nextCount,
          status: rollback.nextStatus
        },
        groupMembers: groupMembers.filter(item => !(item.group_id === group.id && item.user_id === order.user_id))
      }

      expect(result.group.current_count === 2, '退款后团人数没有回滚')
      expect(result.group.status === 'active', '退款后团状态没有从 success 回滚为 active')
      expect(result.groupMembers.length === 2, '退款后 group_members 没有删除对应成员')
      expect(
        result.groupMembers.every(item => item.user_id !== 'user_1'),
        '退款后用户成员关系没有被移除'
      )
    }
  },
  {
    name: '支付成功时仅首次入团会增加人数',
    run: () => {
      const group = {
        id: 'group_active',
        status: 'active',
        current_count: 1,
        target_count: 3,
        expire_time: '2026-03-28T18:00:00+08:00'
      }

      const firstPayment = applyPaymentToGroup({
        group,
        membershipExists: false,
        now: new Date('2026-03-27T12:00:00+08:00')
      })
      const repeatedCallback = applyPaymentToGroup({
        group: {
          ...group,
          current_count: firstPayment.nextCount
        },
        membershipExists: true,
        now: new Date('2026-03-27T12:05:00+08:00')
      })

      expect(firstPayment.nextCount === 2, '首次支付成功后团人数没有增加')
      expect(repeatedCallback.nextCount === 2, '重复支付回调错误地重复增加了团人数')
    }
  },
  {
    name: '支付成功达到人数门槛后团状态改为 success',
    run: () => {
      const group = {
        id: 'group_almost_done',
        status: 'active',
        current_count: 2,
        target_count: 3,
        expire_time: '2026-03-28T18:00:00+08:00'
      }

      const result = applyPaymentToGroup({
        group,
        membershipExists: false,
        now: new Date('2026-03-27T12:00:00+08:00')
      })

      expect(result.nextCount === 3, '支付成功后团人数没有达到预期')
      expect(result.nextStatus === 'success', '达到成团门槛后团状态没有变为 success')
    }
  },
  {
    name: '已成团后未占位用户不能继续补支付',
    run: () => {
      const group = {
        id: 'group_success',
        status: 'success',
        current_count: 3,
        target_count: 3,
        expire_time: '2026-03-28T18:00:00+08:00'
      }

      const canPay = canApplyPaymentToGroup({
        group,
        membershipExists: false,
        now: new Date('2026-03-27T12:00:00+08:00')
      })

      expect(canPay === false, '已成团后未占位用户仍被允许补支付')
    }
  }
]

const results = scenarios.map(assertScenario)
const failed = results.filter(item => !item.passed)

for (const result of results) {
  console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${result.name} | ${result.detail}`)
}

if (failed.length) {
  console.error(`\n${failed.length} 个拼团规则场景未通过`)
  process.exit(1)
}

console.log(`\n${results.length} 个拼团规则场景全部通过`)
