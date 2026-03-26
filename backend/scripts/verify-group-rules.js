const AUTO_REFUND_REASON = '报名截止前未成团，系统自动退款'

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

const createGroupPayload = course => ({
  course_id: course.id,
  status: 'active',
  current_count: 0,
  target_count: course.default_target_count,
  expire_time: course.deadline
})

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

const hasSuccessfulParticipation = ({ userId, successGroupIds, orders }) => {
  const hasSuccessOrder = orders.some(
    item => item.user_id === userId && item.status === 'success'
  )

  const hasSuccessGroupMembership = successGroupIds.length > 0 && orders.some(
    item =>
      item.user_id === userId &&
      successGroupIds.includes(item.group_id) &&
      item.status === 'success'
  )

  return hasSuccessOrder || hasSuccessGroupMembership
}

const scenarios = [
  {
    name: '新拼团截止时间统一等于课程报名截止时间',
    run: () => {
      const course = {
        id: 'course_1',
        deadline: '2026-03-28T18:00:00+08:00',
        default_target_count: 3
      }
      const payload = createGroupPayload(course)
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
      const successGroupIds = []
      const orders = [
        { id: 'order_1', group_id: 'group_1', user_id: 'user_1', status: 'refunded' }
      ]

      const blocked = hasSuccessfulParticipation({ userId, successGroupIds, orders })
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

      const blocked = hasSuccessfulParticipation({ userId, successGroupIds, orders })
      expect(blocked === true, '成功参团记录没有拦截重复成功参团')
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
