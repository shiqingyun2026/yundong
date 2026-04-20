const supabase = require('../../utils/supabase')
const { env } = require('../../config/env')
const { COURSE_STATUS, getCourseLifecycleMap } = require('../../utils/courseLifecycle')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')
const {
  coursePackagesRepository,
  coursesRepository,
  groupMembersRepository,
  groupsRepository,
  ordersRepository,
  packageGroupsRepository
} = require('../../repositories')

const DAY_MS = 24 * 60 * 60 * 1000

const RANGE_PRESETS = {
  today: { label: '今日', days: 1, compareLabel: '较昨日' },
  '7d': { label: '近 7 天', days: 7, compareLabel: '较前 7 天' },
  '30d': { label: '近 30 天', days: 30, compareLabel: '较前 30 天' }
}

const buildRangeDisplayText = (preset, startKey, endKey) => {
  if (preset.days === 1) {
    return `${startKey}（今日）`
  }

  return `${startKey} 至 ${endKey}（含今日，共 ${preset.days} 天）`
}

const getShanghaiDateKey = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') {
      result[part.type] = part.value
    }
    return result
  }, {})

  return `${parts.year}-${parts.month}-${parts.day}`
}

const getRangeByKey = (rangeKey = 'today', now = new Date()) => {
  const preset = RANGE_PRESETS[rangeKey] || RANGE_PRESETS.today
  const endKey = getShanghaiDateKey(now)
  const startKey = getShanghaiDateKey(new Date(now.getTime() - (preset.days - 1) * DAY_MS))
  const currentStart = `${startKey}T00:00:00+08:00`
  const currentEnd = `${endKey}T23:59:59+08:00`
  const previousEndBase = new Date(new Date(currentStart).getTime() - DAY_MS)
  const previousStartBase = new Date(new Date(currentStart).getTime() - preset.days * DAY_MS)
  const previousStartKey = getShanghaiDateKey(previousStartBase)
  const previousEndKey = getShanghaiDateKey(previousEndBase)

  return {
    key: rangeKey in RANGE_PRESETS ? rangeKey : 'today',
    label: preset.label,
    days: preset.days,
    compare_label: preset.compareLabel,
    start_date: startKey,
    end_date: endKey,
    display_text: buildRangeDisplayText(preset, startKey, endKey),
    current: {
      start: currentStart,
      end: currentEnd
    },
    previous: {
      start: `${previousStartKey}T00:00:00+08:00`,
      end: `${previousEndKey}T23:59:59+08:00`
    }
  }
}

const toTimestamp = value => {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const isWithinRange = (value, range) => {
  const timestamp = toTimestamp(value)
  if (timestamp === null) {
    return false
  }

  return timestamp >= toTimestamp(range.start) && timestamp <= toTimestamp(range.end)
}

const buildMetric = (current, previous, allowCompare = true) => {
  if (!allowCompare) {
    return {
      current,
      previous: null,
      delta: null,
      direction: 'none'
    }
  }

  const delta = current - previous
  return {
    current,
    previous,
    delta,
    direction: delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  }
}

const getPackageDashboardSnapshot = ({ packages = [], packageGroups = [], packageOrders = [], range }) => {
  const activePackageCount = (packages || []).filter(item => Number(item.status) === 1).length
  const previousActivePackageCount = activePackageCount

  const createdPackageCount = (packages || []).filter(item => isWithinRange(item.created_at, range.current)).length
  const previousCreatedPackageCount = (packages || []).filter(item => isWithinRange(item.created_at, range.previous)).length

  const successGroups = (packageGroups || []).filter(item => item.status === 'success')
  const successGroupCount = successGroups.filter(item => isWithinRange(item.success_time, range.current)).length
  const previousSuccessGroupCount = successGroups.filter(item => isWithinRange(item.success_time, range.previous)).length

  const paidOrders = (packageOrders || []).filter(item => item.status === 'success')
  const paidMemberCount = paidOrders.filter(item => isWithinRange(item.pay_time, range.current)).length
  const previousPaidMemberCount = paidOrders.filter(item => isWithinRange(item.pay_time, range.previous)).length

  const paidAmount = paidOrders
    .filter(item => isWithinRange(item.pay_time, range.current))
    .reduce((result, item) => result + Number(item.amount || 0), 0)
  const previousPaidAmount = paidOrders
    .filter(item => isWithinRange(item.pay_time, range.previous))
    .reduce((result, item) => result + Number(item.amount || 0), 0)

  const refundedOrderCount = (packageOrders || []).filter(
    item => item.status === 'refunded' && isWithinRange(item.refund_time, range.current)
  ).length
  const previousRefundedOrderCount = (packageOrders || []).filter(
    item => item.status === 'refunded' && isWithinRange(item.refund_time, range.previous)
  ).length

  const groupPaidOrderMap = (packageOrders || []).reduce((result, item) => {
    if (!item.package_group_id) {
      return result
    }

    if (!result[item.package_group_id]) {
      result[item.package_group_id] = []
    }

    if (item.status === 'success') {
      result[item.package_group_id].push(item)
    }
    return result
  }, {})

  const failedGroupPendingRefundCount = (packageGroups || []).filter(item => {
    if (item.status !== 'failed') {
      return false
    }

    return (packageOrders || []).some(order => order.package_group_id === item.id && order.status === 'success')
  }).length

  const expiredActiveGroupCount = (packageGroups || []).filter(item => {
    return item.status === 'active' && toTimestamp(item.deadline) !== null && toTimestamp(item.deadline) < Date.now()
  }).length

  const memberMismatchGroupCount = (packageGroups || []).filter(item => {
    return Number(item.current_count || 0) !== Number((groupPaidOrderMap[item.id] || []).length)
  }).length

  const autoRefundOrderCount = (packageOrders || []).filter(
    item => item.status === 'refunded' && item.refund_reason === AUTO_REFUND_REASON && isWithinRange(item.refund_time, range.current)
  ).length

  return {
    metrics: {
      active_package_count: buildMetric(activePackageCount, previousActivePackageCount, false),
      created_package_count: buildMetric(createdPackageCount, previousCreatedPackageCount),
      success_group_count: buildMetric(successGroupCount, previousSuccessGroupCount),
      paid_member_count: buildMetric(paidMemberCount, previousPaidMemberCount),
      paid_amount: buildMetric(paidAmount, previousPaidAmount),
      refunded_order_count: buildMetric(refundedOrderCount, previousRefundedOrderCount)
    },
    anomalies: {
      failed_group_pending_refund_count: failedGroupPendingRefundCount,
      expired_active_group_count: expiredActiveGroupCount,
      member_mismatch_group_count: memberMismatchGroupCount,
      auto_refund_order_count: Number(autoRefundOrderCount || 0)
    },
    note: '课包概览按课包订单与课包团实时聚合；支付金额以实际支付金额为准，异常提醒为当前系统快照。'
  }
}

const getDashboardOverview = async ({ query = {}, admin = {} }) => {
  const range = getRangeByKey(`${query.range || 'today'}`.trim() || 'today')

  if (env.useMySqlRepositories) {
    const [courses, groups, members, orders, packages, packageGroups, packageOrders] = await Promise.all([
      coursesRepository.listCourses(),
      groupsRepository.listGroups(),
      groupMembersRepository.listGroupMembers(),
      ordersRepository.listOrders({
        orderType: 1
      }),
      coursePackagesRepository && coursePackagesRepository.listPackages
        ? coursePackagesRepository.listPackages()
        : Promise.resolve([]),
      packageGroupsRepository && packageGroupsRepository.listPackageGroups
        ? packageGroupsRepository.listPackageGroups()
        : Promise.resolve([]),
      ordersRepository.listOrders({
        orderType: 2
      })
    ])

    const courseIds = (courses || []).map(item => item.id).filter(Boolean)
    const lifecycleMap = await getCourseLifecycleMap(courseIds, {
      operatorId: admin && admin.id
    })

    const groupingCourseCount = (courses || []).filter(
      item => lifecycleMap[item.id] && lifecycleMap[item.id].status === COURSE_STATUS.GROUPING
    ).length

    const classCourseCount = (courses || []).filter(item => isWithinRange(item.start_time, range.current)).length
    const previousClassCourseCount = (courses || []).filter(item => isWithinRange(item.start_time, range.previous)).length
    const publishCourseCount = (courses || []).filter(item => isWithinRange(item.publish_time, range.current)).length
    const previousPublishCourseCount = (courses || []).filter(item => isWithinRange(item.publish_time, range.previous)).length

    const successGroupIds = new Set((groups || []).filter(item => item.status === 'success').map(item => item.id).filter(Boolean))
    const successSummaryByGroup = (orders || [])
      .filter(item => item.status === 'success' && item.group_id && successGroupIds.has(item.group_id))
      .reduce((result, item) => {
        const candidateTime = item.pay_time || item.created_at || ''
        if (!result[item.group_id]) {
          result[item.group_id] = {
            success_time: candidateTime,
            amount: 0
          }
        }

        if (candidateTime && candidateTime > result[item.group_id].success_time) {
          result[item.group_id].success_time = candidateTime
        }

        result[item.group_id].amount += Number(item.amount || 0)
        return result
      }, {})

    const successGroupEntries = Object.values(successSummaryByGroup)
    const successGroupCount = successGroupEntries.filter(item => isWithinRange(item.success_time, range.current)).length
    const previousSuccessGroupCount = successGroupEntries.filter(item => isWithinRange(item.success_time, range.previous)).length
    const successfulGroupAmount = successGroupEntries
      .filter(item => isWithinRange(item.success_time, range.current))
      .reduce((result, item) => result + Number(item.amount || 0), 0)
    const previousSuccessfulGroupAmount = successGroupEntries
      .filter(item => isWithinRange(item.success_time, range.previous))
      .reduce((result, item) => result + Number(item.amount || 0), 0)

    const groupMemberCount = (members || []).filter(item => isWithinRange(item.joined_at, range.current)).length
    const previousGroupMemberCount = (members || []).filter(item => isWithinRange(item.joined_at, range.previous)).length
    const autoRefundOrderCount = (orders || []).filter(
      item => item.status === 'refunded' && item.refund_reason === AUTO_REFUND_REASON && isWithinRange(item.refund_time, range.current)
    ).length

    const memberCountByGroup = (members || []).reduce((result, item) => {
      result[item.group_id] = (result[item.group_id] || 0) + 1
      return result
    }, {})

    const ordersByGroup = (orders || []).reduce((result, item) => {
      if (!result[item.group_id]) {
        result[item.group_id] = []
      }
      result[item.group_id].push(item)
      return result
    }, {})

    const failedGroupPendingRefundCount = (groups || []).filter(item => {
      if (item.status !== 'failed') {
        return false
      }

      return (ordersByGroup[item.id] || []).some(order => order.status !== 'refunded')
    }).length

    const expiredActiveGroupCount = (groups || []).filter(item => {
      return item.status === 'active' && toTimestamp(item.expire_time) !== null && toTimestamp(item.expire_time) < Date.now()
    }).length

    const memberMismatchGroupCount = (groups || []).filter(item => {
      return Number(item.current_count || 0) !== Number(memberCountByGroup[item.id] || 0)
    }).length

    const packageSnapshot = getPackageDashboardSnapshot({
      packages,
      packageGroups,
      packageOrders,
      range
    })

    return {
      range: {
        key: range.key,
        label: range.label,
        days: range.days,
        compare_label: range.compare_label,
        start_date: range.start_date,
        end_date: range.end_date,
        display_text: range.display_text
      },
      metrics: {
        grouping_course_count: buildMetric(groupingCourseCount, 0, false),
        class_course_count: buildMetric(classCourseCount, previousClassCourseCount),
        publish_course_count: buildMetric(publishCourseCount, previousPublishCourseCount),
        success_group_count: buildMetric(successGroupCount, previousSuccessGroupCount),
        group_member_count: buildMetric(Number(groupMemberCount || 0), Number(previousGroupMemberCount || 0)),
        successful_group_amount: buildMetric(successfulGroupAmount, previousSuccessfulGroupAmount)
      },
      anomalies: {
        failed_group_pending_refund_count: failedGroupPendingRefundCount,
        expired_active_group_count: expiredActiveGroupCount,
        member_mismatch_group_count: memberMismatchGroupCount,
        auto_refund_order_count: Number(autoRefundOrderCount || 0)
      },
      package_metrics: packageSnapshot.metrics,
      package_anomalies: packageSnapshot.anomalies,
      note: packageSnapshot.note
    }
  }

  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('id, publish_time, start_time')

  if (courseError) {
    throw courseError
  }

  const courseIds = (courses || []).map(item => item.id).filter(Boolean)
  const lifecycleMap = await getCourseLifecycleMap(courseIds, {
    operatorId: admin && admin.id
  })

  const groupingCourseCount = (courses || []).filter(
    item => lifecycleMap[item.id] && lifecycleMap[item.id].status === COURSE_STATUS.GROUPING
  ).length

  const classCourseCount = (courses || []).filter(item => isWithinRange(item.start_time, range.current)).length
  const previousClassCourseCount = (courses || []).filter(item => isWithinRange(item.start_time, range.previous)).length

  const publishCourseCount = (courses || []).filter(item => isWithinRange(item.publish_time, range.current)).length
  const previousPublishCourseCount = (courses || []).filter(item => isWithinRange(item.publish_time, range.previous)).length

  const { data: successGroups, error: successGroupError } = await supabase
    .from('groups')
    .select('id, status')
    .eq('status', 'success')

  if (successGroupError) {
    throw successGroupError
  }

  const successGroupIds = (successGroups || []).map(item => item.id).filter(Boolean)
  const { data: successOrders, error: successOrderError } = successGroupIds.length
    ? await supabase
        .from('orders')
        .select('id, group_id, amount, pay_time, created_at, status, order_type')
        .in('group_id', successGroupIds)
        .eq('order_type', 1)
        .eq('status', 'success')
    : { data: [], error: null }

  if (successOrderError) {
    throw successOrderError
  }

  const successSummaryByGroup = (successOrders || []).reduce((result, item) => {
    const groupId = item.group_id
    const candidateTime = item.pay_time || item.created_at || ''
    if (!groupId) {
      return result
    }

    if (!result[groupId]) {
      result[groupId] = {
        success_time: candidateTime,
        amount: 0
      }
    }

    if (candidateTime && candidateTime > result[groupId].success_time) {
      result[groupId].success_time = candidateTime
    }

    result[groupId].amount += Number(item.amount || 0)
    return result
  }, {})

  const successGroupEntries = Object.values(successSummaryByGroup)
  const successGroupCount = successGroupEntries.filter(item => isWithinRange(item.success_time, range.current)).length
  const previousSuccessGroupCount = successGroupEntries.filter(item => isWithinRange(item.success_time, range.previous)).length
  const successfulGroupAmount = successGroupEntries
    .filter(item => isWithinRange(item.success_time, range.current))
    .reduce((result, item) => result + Number(item.amount || 0), 0)
  const previousSuccessfulGroupAmount = successGroupEntries
    .filter(item => isWithinRange(item.success_time, range.previous))
    .reduce((result, item) => result + Number(item.amount || 0), 0)

  const { count: groupMemberCount, error: groupMemberError } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .gte('joined_at', range.current.start)
    .lte('joined_at', range.current.end)

  if (groupMemberError) {
    throw groupMemberError
  }

  const { count: previousGroupMemberCount, error: previousGroupMemberError } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .gte('joined_at', range.previous.start)
    .lte('joined_at', range.previous.end)

  if (previousGroupMemberError) {
    throw previousGroupMemberError
  }

  const { count: autoRefundOrderCount, error: autoRefundOrderError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_type', 1)
    .eq('status', 'refunded')
    .eq('refund_reason', AUTO_REFUND_REASON)
    .gte('refund_time', range.current.start)
    .lte('refund_time', range.current.end)

  if (autoRefundOrderError) {
    throw autoRefundOrderError
  }

  const [{ data: groups, error: groupsError }, { data: members, error: membersError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase.from('groups').select('id, status, current_count, target_count, expire_time'),
      supabase.from('group_members').select('group_id'),
      supabase.from('orders').select('group_id, status, order_type').eq('order_type', 1)
    ])

  if (groupsError) {
    throw groupsError
  }
  if (membersError) {
    throw membersError
  }
  if (ordersError) {
    throw ordersError
  }

  const memberCountByGroup = (members || []).reduce((result, item) => {
    result[item.group_id] = (result[item.group_id] || 0) + 1
    return result
  }, {})

  const ordersByGroup = (orders || []).reduce((result, item) => {
    if (!result[item.group_id]) {
      result[item.group_id] = []
    }
    result[item.group_id].push(item)
    return result
  }, {})

  const failedGroupPendingRefundCount = (groups || []).filter(item => {
    if (item.status !== 'failed') {
      return false
    }

    return (ordersByGroup[item.id] || []).some(order => order.status !== 'refunded')
  }).length

  const expiredActiveGroupCount = (groups || []).filter(item => {
    return item.status === 'active' && toTimestamp(item.expire_time) !== null && toTimestamp(item.expire_time) < Date.now()
  }).length

  const memberMismatchGroupCount = (groups || []).filter(item => {
    return Number(item.current_count || 0) !== Number(memberCountByGroup[item.id] || 0)
  }).length

  return {
    range: {
      key: range.key,
      label: range.label,
      days: range.days,
      compare_label: range.compare_label,
      start_date: range.start_date,
      end_date: range.end_date,
      display_text: range.display_text
    },
    metrics: {
      grouping_course_count: buildMetric(groupingCourseCount, 0, false),
      class_course_count: buildMetric(classCourseCount, previousClassCourseCount),
      publish_course_count: buildMetric(publishCourseCount, previousPublishCourseCount),
      success_group_count: buildMetric(successGroupCount, previousSuccessGroupCount),
      group_member_count: buildMetric(Number(groupMemberCount || 0), Number(previousGroupMemberCount || 0)),
      successful_group_amount: buildMetric(successfulGroupAmount, previousSuccessfulGroupAmount)
    },
    anomalies: {
      failed_group_pending_refund_count: failedGroupPendingRefundCount,
      expired_active_group_count: expiredActiveGroupCount,
      member_mismatch_group_count: memberMismatchGroupCount,
      auto_refund_order_count: Number(autoRefundOrderCount || 0)
    },
    note: '成团数与成团金额按成功团内最后一笔支付成功时间近似统计；异常提醒为当前系统快照。'
  }
}

module.exports = {
  getDashboardOverview
}
