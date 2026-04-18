const { COURSE_STATUS } = require('../../utils/courseLifecycle')
const { normalizeGroupStatus } = require('../domain/groupRules')
const { formatCourseTimeRange, formatDateTime, formatPrice, getRemainingSeconds } = require('../utils/formatters')

const getCourseStageText = (groupStatus, courseLifecycleStatus) => {
  if (groupStatus !== 'success') {
    return ''
  }

  return Number(courseLifecycleStatus) === COURSE_STATUS.FINISHED ? '已结课' : '等待上课'
}

const getUserGroupStatusText = status => {
  if (status === 'ongoing') {
    return '进行中'
  }

  if (status === 'success') {
    return '已成团'
  }

  return '已失败'
}

const mapGroupMembers = (memberRows, usersById = {}) => {
  return (memberRows || []).map(item => ({
    avatar: (usersById[item.user_id] && usersById[item.user_id].avatar_url) || '',
    nickName: (usersById[item.user_id] && usersById[item.user_id].nickname) || '微信用户'
  }))
}

const mapGroupDetailResponse = ({ group, lifecycleStatus, course, members, userJoined }) => ({
  groupId: group.id,
  courseId: group.course_id,
  status: normalizeGroupStatus(group.status),
  courseStatusText: getCourseStageText(group.status, lifecycleStatus),
  currentCount: Number(group.current_count) || 0,
  targetCount: Number(group.target_count) || 0,
  remainingSeconds: getRemainingSeconds(group.expire_time),
  expireTime: group.expire_time,
  refundDesc: '报名截止时间未成团将自动原路退款',
  deadlineText: formatDateTime(group.expire_time),
  userJoined: !!userJoined,
  members: members || [],
  courseInfo: {
    id: course.id,
    title: course.name || '',
    groupPriceText: formatPrice(course.group_price),
    originalPriceText: formatPrice(course.original_price),
    targetCount: Number(group.target_count) || 0,
    joinedCount: Number(group.current_count) || 0,
    timeText: formatCourseTimeRange(course.start_time),
    locationText: course.address || '',
    ageRange: '',
    cover: course.cover || '',
    serviceQrCode: ''
  }
})

const mapUserGroupListItem = ({ group, course, lifecycleStatus }) => {
  const normalizedStatus = normalizeGroupStatus(group.status)

  return {
    groupId: group.id,
    courseId: group.course_id,
    cover: course.cover || '',
    title: course.name || '',
    timeText: formatCourseTimeRange(course.start_time),
    locationText: course.address || '',
    status: normalizedStatus,
    statusText: getUserGroupStatusText(normalizedStatus),
    courseStatusText: getCourseStageText(group.status, lifecycleStatus),
    currentCount: Number(group.current_count) || 0,
    targetCount: Number(group.target_count) || 0,
    expireTime: group.expire_time || ''
  }
}

module.exports = {
  getCourseStageText,
  getUserGroupStatusText,
  mapGroupDetailResponse,
  mapGroupMembers,
  mapUserGroupListItem
}
