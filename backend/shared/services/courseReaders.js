const { COURSE_STATUS, getCourseLifecycleMap, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const {
  buildActiveGroupMap,
  mapActiveGroup,
  mapCourseDetail,
  mapCourseGroupSummary,
  mapCourseListItem,
  summarizeSuccessGroupStats
} = require('../presenters/courseView')
const { fetchGroupMembers, hasGroupMembership } = require('./groupReaders')

const MINI_PROGRAM_VISIBLE_STATUSES = new Set([
  COURSE_STATUS.GROUPING,
  COURSE_STATUS.WAITING_CLASS,
  COURSE_STATUS.IN_CLASS
])

const createNotFoundError = message => {
  const error = new Error(message)
  error.statusCode = 404
  error.code = 'MINIPROGRAM_COURSE_NOT_FOUND'
  return error
}

const canDisplayInMiniProgram = status => MINI_PROGRAM_VISIBLE_STATUSES.has(Number(status))

const fetchMiniProgramCourseList = async ({ supabase, page = 1, pageSize = 10, sort = 'distance' }) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const safeSort = sort === 'time' ? 'time' : 'distance'
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  const { data: courses, error } = await supabase
    .from('courses')
    .select(
      'id, cover, name, address, start_time, end_time, publish_time, unpublish_time, deadline, group_price, original_price, max_groups, status'
    )
    .order('start_time', { ascending: safeSort === 'time' })

  if (error) {
    throw error
  }

  const courseIds = (courses || []).map(item => item.id).filter(Boolean)
  const lifecycleMap = await getCourseLifecycleMap(courseIds, {})
  const visibleCourses = (courses || []).filter(item => {
    const lifecycle = lifecycleMap[item.id]
    return lifecycle && canDisplayInMiniProgram(lifecycle.status)
  })
  const pagedCourses = visibleCourses.slice(from, to + 1)

  let activeGroupMap = {}
  let successStatsMap = {}

  if (pagedCourses.length) {
    const pagedCourseIds = pagedCourses.map(item => item.id).filter(Boolean)
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, course_id, expire_time, current_count, target_count')
      .in('course_id', pagedCourseIds)
      .eq('status', 'active')
      .gt('expire_time', new Date().toISOString())
      .order('expire_time', { ascending: false })

    if (groupsError) {
      throw groupsError
    }

    activeGroupMap = buildActiveGroupMap(groups || [])

    const { data: successGroups, error: successGroupsError } = await supabase
      .from('groups')
      .select('course_id, current_count')
      .in('course_id', pagedCourseIds)
      .eq('status', 'success')

    if (successGroupsError) {
      throw successGroupsError
    }

    successStatsMap = summarizeSuccessGroupStats(successGroups || [])
  }

  const list = pagedCourses.map(item => {
    const activeGroup = activeGroupMap[item.id] || null
    const successStats = successStatsMap[item.id] || {
      completedGroupsCount: 0,
      successJoinedCount: 0
    }

    return mapCourseListItem(item, activeGroup, successStats)
  })

  return {
    data: list,
    list,
    total: visibleCourses.length,
    page: safePage,
    pageSize: safePageSize,
    hasMore: from + list.length < visibleCourses.length
  }
}

const fetchMiniProgramCourseDetail = async ({ supabase, courseId }) => {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!course) {
    throw createNotFoundError('course not found')
  }

  const lifecycle = await getSingleCourseLifecycle(course.id)
  if (!canDisplayInMiniProgram(lifecycle.status)) {
    throw createNotFoundError('course not found')
  }

  const { data: activeGroup, error: activeGroupError } = await supabase
    .from('groups')
    .select('id, course_id, current_count, target_count, expire_time')
    .eq('course_id', course.id)
    .eq('status', 'active')
    .gt('expire_time', new Date().toISOString())
    .order('expire_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (activeGroupError) {
    throw activeGroupError
  }

  const { data: successGroups, error: successGroupsError } = await supabase
    .from('groups')
    .select('id, current_count')
    .eq('course_id', course.id)
    .eq('status', 'success')

  if (successGroupsError) {
    throw successGroupsError
  }

  const completedGroupsCount = (successGroups || []).length
  const successJoinedCount = (successGroups || []).reduce((total, group) => {
    return total + (Number(group.current_count) || 0)
  }, 0)

  const { data: groupList, error: groupListError } = await supabase
    .from('groups')
    .select('id, status, current_count, target_count, expire_time')
    .eq('course_id', course.id)
    .order('expire_time', { ascending: false })

  if (groupListError) {
    throw groupListError
  }

  return {
    ...mapCourseDetail(
      course,
      activeGroup,
      completedGroupsCount,
      successJoinedCount,
      (groupList || []).map(mapCourseGroupSummary)
    ),
    status: lifecycle.status
  }
}

const fetchMiniProgramCourseActiveGroup = async ({ supabase, courseId, userId = '' }) => {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  if (courseError) {
    throw courseError
  }

  if (!course) {
    return null
  }

  const lifecycle = await getSingleCourseLifecycle(course.id)
  if (!canDisplayInMiniProgram(lifecycle.status)) {
    return null
  }

  let { data: group, error } = await supabase
    .from('groups')
    .select('id, course_id, current_count, target_count, expire_time, status')
    .eq('course_id', courseId)
    .eq('status', 'active')
    .gt('expire_time', new Date().toISOString())
    .order('expire_time', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!group) {
    const { data: latestGroup, error: latestGroupError } = await supabase
      .from('groups')
      .select('id, course_id, current_count, target_count, expire_time, status')
      .eq('course_id', courseId)
      .in('status', ['success', 'failed'])
      .order('expire_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestGroupError) {
      throw latestGroupError
    }

    group = latestGroup
  }

  if (!group) {
    return null
  }

  const members = await fetchGroupMembers({
    supabase,
    groupId: group.id
  })
  const userJoined = userId
    ? await hasGroupMembership({
        supabase,
        groupId: group.id,
        userId
      })
    : false

  return {
    ...mapActiveGroup(group, members),
    userJoined
  }
}

module.exports = {
  MINI_PROGRAM_VISIBLE_STATUSES,
  canDisplayInMiniProgram,
  fetchMiniProgramCourseActiveGroup,
  fetchMiniProgramCourseDetail,
  fetchMiniProgramCourseList
}
