const { env } = require('../../config/env')
const { coursesRepository, groupMembersRepository, groupsRepository, usersRepository } = require('../../repositories')
const { getCourseLifecycleMap, getSingleCourseLifecycle } = require('../../utils/courseLifecycle')
const { mapGroupDetailResponse, mapGroupMembers, mapUserGroupListItem } = require('../presenters/groupView')

const createNotFoundError = message => {
  const error = new Error(message)
  error.statusCode = 404
  error.code = 'MINIPROGRAM_GROUP_NOT_FOUND'
  return error
}

const createForbiddenError = message => {
  const error = new Error(message)
  error.statusCode = 403
  error.code = 'MINIPROGRAM_GROUP_FORBIDDEN'
  return error
}

const normalizeStatusFilter = status => {
  if (status === 'ongoing') {
    return 'active'
  }

  if (status === 'active' || status === 'success' || status === 'failed') {
    return status
  }

  return ''
}

const fetchUsersByIds = async ({ supabase, userIds }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return {}
  }

  if (env.useMySqlRepositories) {
    const users = await usersRepository.listUsersByIds(ids)
    return (users || []).reduce((result, user) => {
      result[user.id] = user
      return result
    }, {})
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, nickname, avatar_url')
    .in('id', ids)

  if (usersError) {
    throw usersError
  }

  return (users || []).reduce((result, user) => {
    result[user.id] = user
    return result
  }, {})
}

const fetchGroupMembers = async ({ supabase, groupId }) => {
  if (env.useMySqlRepositories) {
    const memberRows = await groupMembersRepository.listGroupMembers({
      groupId
    })

    const userIds = memberRows.map(item => item.user_id).filter(Boolean)
    const usersById = await fetchUsersByIds({
      supabase,
      userIds
    })

    return mapGroupMembers(memberRows, usersById)
  }

  const { data: memberRows, error: memberRowsError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  if (memberRowsError) {
    throw memberRowsError
  }

  const userIds = (memberRows || []).map(item => item.user_id).filter(Boolean)
  const usersById = await fetchUsersByIds({
    supabase,
    userIds
  })

  return mapGroupMembers(memberRows, usersById)
}

const hasGroupMembership = async ({ supabase, groupId, userId }) => {
  if (!groupId || !userId) {
    return false
  }

  if (env.useMySqlRepositories) {
    const membership = await groupMembersRepository.findMembership({
      groupId,
      userId
    })

    return !!membership
  }

  const { data: membership, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return !!membership
}

const fetchMiniProgramGroupDetail = async ({ supabase, groupId, userId }) => {
  const hasJoined = await hasGroupMembership({
    supabase,
    groupId,
    userId
  })

  if (!hasJoined) {
    throw createForbiddenError('You are not a member of this group')
  }

  const group = env.useMySqlRepositories
    ? await groupsRepository.findGroupById(groupId)
    : await (async () => {
        const { data, error } = await supabase
          .from('groups')
          .select('id, course_id, status, current_count, target_count, expire_time')
          .eq('id', groupId)
          .maybeSingle()

        if (error) {
          throw error
        }

        return data
      })()

  if (!group) {
    throw createNotFoundError('group not found')
  }

  const members = await fetchGroupMembers({
    supabase,
    groupId: group.id
  })

  const course = env.useMySqlRepositories
    ? await coursesRepository.findCourseById(group.course_id)
    : await (async () => {
        const { data, error } = await supabase
          .from('courses')
          .select('id, name, cover, address, start_time, group_price, original_price')
          .eq('id', group.course_id)
          .maybeSingle()

        if (error) {
          throw error
        }

        return data
      })()

  if (!course) {
    throw createNotFoundError('course not found')
  }

  const lifecycle = await getSingleCourseLifecycle(course.id)

  return mapGroupDetailResponse({
    group,
    lifecycleStatus: lifecycle.status,
    course,
    members,
    userJoined: true
  })
}

const fetchMiniProgramUserGroupList = async ({ supabase, userId, status, page = 1, pageSize = 10 }) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const normalizedStatus = normalizeStatusFilter(status)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let data = []
  let count = 0

  if (env.useMySqlRepositories) {
    const memberships = await groupMembersRepository.listGroupMembers({
      userId
    })
    const groupIds = memberships.map(item => item.group_id).filter(Boolean)
    const groups = await groupsRepository.listGroups({
      statuses: normalizedStatus ? [normalizedStatus] : []
    })
    const groupById = groups.reduce((result, item) => {
      if (groupIds.includes(item.id)) {
        result[item.id] = item
      }
      return result
    }, {})

    const filteredMemberships = memberships.filter(item => groupById[item.group_id])
    count = filteredMemberships.length

    const pagedMemberships = filteredMemberships.slice(from, to + 1)
    const courseIds = [...new Set(pagedMemberships.map(item => (groupById[item.group_id] && groupById[item.group_id].course_id) || '').filter(Boolean))]
    const courses = await coursesRepository.findCoursesByIds(courseIds)
    const courseById = courses.reduce((result, item) => {
      result[item.id] = item
      return result
    }, {})

    data = pagedMemberships.map(item => ({
      group_id: item.group_id,
      joined_at: item.joined_at,
      groups: {
        ...groupById[item.group_id],
        courses: courseById[(groupById[item.group_id] && groupById[item.group_id].course_id) || ''] || null
      }
    }))
  } else {
    let query = supabase
      .from('group_members')
      .select(
        'group_id, joined_at, groups!inner(id, course_id, status, current_count, target_count, expire_time, courses!inner(id, cover, name, address, start_time))',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .range(from, to)

    if (normalizedStatus) {
      query = query.eq('groups.status', normalizedStatus)
    }

    const response = await query

    if (response.error) {
      throw response.error
    }

    data = response.data || []
    count = response.count || 0
  }

  const courseIds = (data || [])
    .map(item => {
      const group = Array.isArray(item.groups) ? item.groups[0] : item.groups
      const course =
        group && group.courses
          ? Array.isArray(group.courses)
            ? group.courses[0]
            : group.courses
          : null

      return course && course.id
    })
    .filter(Boolean)
  const lifecycleMap = await getCourseLifecycleMap(courseIds, {})

  const list = (data || [])
    .map(item => {
      const group = Array.isArray(item.groups) ? item.groups[0] : item.groups
      const course =
        group && group.courses
          ? Array.isArray(group.courses)
            ? group.courses[0]
            : group.courses
          : null

      if (!group || !course) {
        return null
      }

      const lifecycle = lifecycleMap[course.id]

      return mapUserGroupListItem({
        group,
        course,
        lifecycleStatus: lifecycle && lifecycle.status
      })
    })
    .filter(Boolean)

  return {
    list,
    data: list,
    total: count || 0,
    page: safePage,
    pageSize: safePageSize,
    hasMore: from + list.length < (count || 0)
  }
}

module.exports = {
  fetchGroupMembers,
  fetchMiniProgramGroupDetail,
  fetchMiniProgramUserGroupList,
  hasGroupMembership,
  normalizeStatusFilter,
  fetchUsersByIds
}
