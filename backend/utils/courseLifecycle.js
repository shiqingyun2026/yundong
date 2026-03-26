const supabase = require('./supabase')
const { writeAdminLog } = require('./adminStore')

const COURSE_STATUS = {
  PENDING_PUBLISH: 0,
  GROUPING: 1,
  GROUP_FAILED: 2,
  WAITING_CLASS: 3,
  IN_CLASS: 4,
  FINISHED: 5,
  UNPUBLISHED: 6
}

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toISOString = value => {
  const date = safeDate(value)
  return date ? date.toISOString() : null
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[courseLifecycle] write admin log failed', error)
  }
}

const computeCourseLifecycleStatus = (course, stats = {}, now = new Date()) => {
  const publishTime = safeDate(course.publish_time)
  const deadline = safeDate(course.deadline)
  const startTime = safeDate(course.start_time)
  const endTime = safeDate(course.end_time)
  const unpublishTime = safeDate(course.unpublish_time)
  const successGroupCount = Number(stats.successGroupCount) || 0

  if (unpublishTime && now.getTime() >= unpublishTime.getTime()) {
    return COURSE_STATUS.UNPUBLISHED
  }

  if (endTime && now.getTime() >= endTime.getTime()) {
    return COURSE_STATUS.FINISHED
  }

  if (successGroupCount > 0) {
    if (startTime && endTime && now.getTime() >= startTime.getTime() && now.getTime() < endTime.getTime()) {
      return COURSE_STATUS.IN_CLASS
    }

    return COURSE_STATUS.WAITING_CLASS
  }

  if (deadline && now.getTime() >= deadline.getTime()) {
    return COURSE_STATUS.GROUP_FAILED
  }

  if (publishTime && now.getTime() < publishTime.getTime()) {
    return COURSE_STATUS.PENDING_PUBLISH
  }

  return COURSE_STATUS.GROUPING
}

const summarizeGroupsByCourse = groups => {
  return (groups || []).reduce((result, item) => {
    const current = result[item.course_id] || {
      successGroupCount: 0,
      activeGroupIds: []
    }

    if (item.status === 'success') {
      current.successGroupCount += 1
    }

    if (item.status === 'active') {
      current.activeGroupIds.push(item.id)
    }

    result[item.course_id] = current
    return result
  }, {})
}

const markFailedCourseRefunds = async ({ course, groupIds = [], operatorId = null, now = new Date() }) => {
  const timestamp = now.toISOString()

  if (groupIds.length) {
    const { error: groupError } = await supabase
      .from('groups')
      .update({
        status: 'failed'
      })
      .in('id', groupIds)

    if (groupError) {
      throw groupError
    }
  }

  const { error: refundError } = await supabase
    .from('orders')
    .update({
      status: 'refunded',
      refund_time: timestamp,
      refund_reason: '报名截止前未成团，系统自动退款',
      refund_operator_id: operatorId
    })
    .eq('course_id', course.id)
    .in('status', ['pending', 'success'])

  if (refundError) {
    throw refundError
  }
}

const syncCourseLifecycle = async (courseIds = [], options = {}) => {
  const uniqueCourseIds = [...new Set((courseIds || []).filter(Boolean))]
  if (!uniqueCourseIds.length) {
    return {}
  }

  const now = options.now instanceof Date ? options.now : new Date()
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('id, publish_time, unpublish_time, deadline, start_time, end_time, status')
    .in('id', uniqueCourseIds)

  if (courseError) {
    throw courseError
  }

  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('id, course_id, status')
    .in('course_id', uniqueCourseIds)

  if (groupError) {
    throw groupError
  }

  const groupSummaryByCourse = summarizeGroupsByCourse(groups || [])
  const result = {}

  for (const course of courses || []) {
    const stats = groupSummaryByCourse[course.id] || {
      successGroupCount: 0,
      activeGroupIds: []
    }

    const nextStatus = computeCourseLifecycleStatus(course, stats, now)
    const shouldAutoRefund = nextStatus === COURSE_STATUS.GROUP_FAILED && stats.successGroupCount === 0

    if (shouldAutoRefund) {
      await markFailedCourseRefunds({
        course,
        groupIds: stats.activeGroupIds,
        operatorId: options.operatorId || null,
        now
      })

      if (options.operatorId) {
        await safeWriteAdminLog({
          adminId: options.operatorId,
          action: 'course_auto_refund',
          targetType: 'course',
          targetId: course.id,
          detail: {
            next_status: nextStatus,
            active_group_ids: stats.activeGroupIds,
            success_group_count: stats.successGroupCount,
            refund_reason: '报名截止前未成团，系统自动退款'
          },
          ip: null
        })
      }
    }

    if (course.status !== nextStatus) {
      const { error: updateCourseError } = await supabase
        .from('courses')
        .update({
          status: nextStatus,
          updated_at: toISOString(now) || new Date().toISOString()
        })
        .eq('id', course.id)

      if (updateCourseError) {
        throw updateCourseError
      }

      if (options.operatorId) {
        await safeWriteAdminLog({
          adminId: options.operatorId,
          action: 'course_status_sync',
          targetType: 'course',
          targetId: course.id,
          detail: {
            previous_status: course.status,
            next_status: nextStatus,
            success_group_count: stats.successGroupCount,
            active_group_ids: stats.activeGroupIds
          },
          ip: null
        })
      }
    }

    result[course.id] = {
      status: nextStatus,
      successGroupCount: stats.successGroupCount,
      activeGroupIds: stats.activeGroupIds
    }
  }

  return result
}

const getCourseLifecycleMap = async (courseIds = [], options = {}) => {
  const uniqueCourseIds = [...new Set((courseIds || []).filter(Boolean))]
  if (!uniqueCourseIds.length) {
    return {}
  }

  return syncCourseLifecycle(uniqueCourseIds, options)
}

const getSingleCourseLifecycle = async (courseId, options = {}) => {
  const lifecycleMap = await getCourseLifecycleMap([courseId], options)
  return lifecycleMap[courseId] || {
    status: COURSE_STATUS.PENDING_PUBLISH,
    successGroupCount: 0,
    activeGroupIds: []
  }
}

const syncAllCourseLifecycles = async (options = {}) => {
  const { data, error } = await supabase.from('courses').select('id')

  if (error) {
    throw error
  }

  const courseIds = (data || []).map(item => item.id).filter(Boolean)
  return getCourseLifecycleMap(courseIds, options)
}

module.exports = {
  COURSE_STATUS,
  safeDate,
  computeCourseLifecycleStatus,
  getCourseLifecycleMap,
  getSingleCourseLifecycle,
  syncAllCourseLifecycles
}
