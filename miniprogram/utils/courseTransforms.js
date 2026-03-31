const { formatCourseStartTime, formatCourseTimeRange, formatPrice, formatDistance, formatTime } = require('./util')
const {
  SERVICE_QR_CODE,
  buildDescriptionNodes,
  GROUP_RULE_NODES,
  PAYMENT_GROUP_NOTE_NODES,
  ACTIVE_GROUP_MAP
} = require('./courseFixtures')

const getActiveGroupCount = courseId => {
  const activeGroup = ACTIVE_GROUP_MAP[courseId]
  return activeGroup ? activeGroup.currentCount : 0
}

const mapCourseListItem = item => ({
  id: item.id,
  cover: item.cover,
  title: item.title,
  timeText: formatCourseStartTime(item.startTime),
  locationText: item.location,
  groupPriceText: formatPrice(item.groupPrice),
  originalPriceText: formatPrice(item.originalPrice),
  joinedCount: getActiveGroupCount(item.id),
  distanceText: formatDistance(item.distanceKm),
  startTimestamp: new Date(item.startTime).getTime(),
  soonGroup: getActiveGroupCount(item.id) >= item.targetCount - 1 && getActiveGroupCount(item.id) > 0
})

const mapCourseDetail = item => ({
  id: item.id,
  title: item.title,
  images: item.images && item.images.length ? item.images : [item.cover],
  groupPriceFen: item.groupPrice,
  groupPriceText: formatPrice(item.groupPrice),
  originalPriceText: formatPrice(item.originalPrice),
  targetCount: item.targetCount,
  joinedCount: getActiveGroupCount(item.id),
  timeText: formatCourseTimeRange(item.startTime, item.endTime),
  locationText: item.location,
  ageRange: item.ageRange,
  descriptionNodes: buildDescriptionNodes(item.title),
  groupRuleNodes: GROUP_RULE_NODES,
  paymentGroupNoteNodes: PAYMENT_GROUP_NOTE_NODES,
  coach: {
    name: item.coachName,
    intro: item.coachIntro,
    certificates: item.coachCertificates
  },
  insuranceText: '本课程赠送运动意外险，由平台统一购买，为孩子提供基础运动安全保障。',
  serviceQrCode: SERVICE_QR_CODE
})

const mapGroupDetail = (groupId, course, groupDetailMap) => {
  const groupDetail = groupDetailMap[groupId]
  if (!groupDetail || !course || groupDetail.courseId !== course.id) {
    return null
  }

  const deadlineDate = new Date(new Date(course.startTime).getTime() - 12 * 3600 * 1000)

  return {
    groupId: groupDetail.groupId,
    courseId: groupDetail.courseId,
    status: groupDetail.status,
    currentCount: groupDetail.currentCount,
    targetCount: groupDetail.targetCount,
    remainingSeconds: groupDetail.remainingSeconds,
    refundDesc: groupDetail.refundDesc,
    deadlineText: formatTime(deadlineDate),
    members: groupDetail.members,
    userJoined: groupDetail.userJoined,
    courseInfo: {
      id: course.id,
      title: course.title,
      groupPriceText: formatPrice(course.groupPrice),
      originalPriceText: formatPrice(course.originalPrice),
      targetCount: course.targetCount,
      joinedCount: groupDetail.currentCount,
      timeText: formatCourseTimeRange(course.startTime, course.endTime),
      locationText: course.location,
      ageRange: course.ageRange,
      cover: course.cover
    }
  }
}

const formatYuanPrice = value => {
  if (value === undefined || value === null || value === '') {
    return '0.00'
  }

  return Number(value).toFixed(2)
}

const normalizeListPayload = payload => {
  if (!payload) {
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
      hasMore: false
    }
  }

  if (Array.isArray(payload)) {
    return {
      list: payload,
      total: payload.length,
      page: 1,
      pageSize: payload.length,
      hasMore: false
    }
  }

  const list = payload.list || payload.data || []

  return {
    ...payload,
    list,
    total: Number(payload.total) || list.length || 0,
    page: Number(payload.page) || 1,
    pageSize: Number(payload.pageSize) || list.length || 10,
    hasMore:
      typeof payload.hasMore === 'boolean'
        ? payload.hasMore
        : (Number(payload.page) || 1) * (Number(payload.pageSize) || list.length || 10) < (Number(payload.total) || list.length || 0)
  }
}

const normalizeActiveGroup = payload => {
  if (!payload) {
    return payload
  }

  return {
    ...payload,
    groupId: payload.groupId || payload.group_id || '',
    courseId: payload.courseId || payload.course_id || '',
    status: payload.status || '',
    currentCount: Number(payload.currentCount ?? payload.current_count) || 0,
    targetCount: Number(payload.targetCount ?? payload.target_count) || 0,
    expireTime: payload.expireTime || payload.expire_time || '',
    userJoined: !!payload.userJoined,
    remainingSeconds:
      Number(payload.remainingSeconds ?? payload.remaining_seconds) ||
      (payload.expireTime || payload.expire_time
        ? Math.max(0, Math.floor((new Date(payload.expireTime || payload.expire_time).getTime() - Date.now()) / 1000))
        : 0),
    members: payload.members || []
  }
}

const normalizeCourseListItem = item => {
  const activeGroup = item.activeGroup
    ? {
        ...item.activeGroup,
        groupId: item.activeGroup.groupId || item.activeGroup.group_id || '',
        expireTime: item.activeGroup.expireTime || item.activeGroup.expire_time || '',
        currentCount: Number(item.activeGroup.currentCount ?? item.activeGroup.current_count) || 0,
        targetCount: Number(item.activeGroup.targetCount ?? item.activeGroup.target_count) || 0
      }
    : null
  const joinedCount = Number(activeGroup ? activeGroup.currentCount : item.joinedCount ?? item.current_count) || 0
  const targetCount = Number(activeGroup ? activeGroup.targetCount : item.targetCount ?? item.target_count) || 0
  const groupPrice =
    item.groupPriceText !== undefined
      ? item.groupPriceText
      : formatYuanPrice(item.groupPrice ?? item.group_price)
  const originalPrice =
    item.originalPriceText !== undefined
      ? item.originalPriceText
      : formatYuanPrice(item.originalPrice ?? item.original_price)
  const startTime = item.startTime || item.start_time || ''
  const remainingCount = activeGroup ? Math.max(0, targetCount - joinedCount) : 0

  return {
    ...item,
    id: item.id,
    title: item.title || item.name || '',
    timeText: item.timeText || formatCourseStartTime(startTime),
    locationText: item.locationText || item.location || item.address || '',
    groupPriceText: `${groupPrice}`,
    originalPriceText: `${originalPrice}`,
    joinedCount,
    targetCount,
    maxGroups: Number(item.maxGroups ?? item.max_groups) || 0,
    completedGroupsCount: Number(item.completedGroupsCount ?? item.completed_groups_count) || 0,
    successJoinedCount: Number(item.successJoinedCount ?? item.success_joined_count) || 0,
    activeGroup,
    distanceText: item.distanceText || '',
    startTimestamp: item.startTimestamp || (startTime ? new Date(startTime).getTime() : 0),
    soonGroup:
      typeof item.soonGroup === 'boolean'
        ? item.soonGroup
        : !!(activeGroup && joinedCount > 0 && targetCount > 0 && joinedCount < targetCount && remainingCount <= 3)
  }
}

const normalizeCourseDetail = payload => {
  if (!payload) {
    return payload
  }

  const groupPriceText =
    payload.groupPriceText !== undefined
      ? payload.groupPriceText
      : formatYuanPrice(payload.groupPrice ?? payload.group_price)
  const originalPriceText =
    payload.originalPriceText !== undefined
      ? payload.originalPriceText
      : formatYuanPrice(payload.originalPrice ?? payload.original_price)
  const joinedCount = Number(payload.current_count ?? payload.joinedCount) || 0
  const targetCount = Number(payload.targetCount ?? payload.target_count) || 0
  const startTime = payload.startTime || payload.start_time || ''
  const activeGroup = normalizeActiveGroup(payload.activeGroup || payload.active_group || null)

  return {
    ...payload,
    id: payload.id,
    title: payload.title || payload.name || '',
    images: payload.images || [],
    groupPriceFen:
      payload.groupPriceFen !== undefined
        ? payload.groupPriceFen
        : Number(payload.groupPrice ?? payload.group_price ?? 0),
    groupPriceText: `${groupPriceText}`,
    originalPriceText: `${originalPriceText}`,
    targetCount,
    joinedCount,
    maxGroups: Number(payload.maxGroups ?? payload.max_groups) || 0,
    completedGroupsCount: Number(payload.completedGroupsCount ?? payload.completed_groups_count) || 0,
    successJoinedCount: Number(payload.successJoinedCount ?? payload.success_joined_count) || 0,
    activeGroup,
    timeText: payload.timeText || formatCourseTimeRange(startTime, payload.endTime || payload.end_time || startTime),
    locationText: payload.locationText || payload.location || payload.address || '',
    ageRange: payload.ageRange || payload.age_range || payload.age_limit || '',
    descriptionHtml: payload.descriptionHtml || payload.description_html || '',
    insuranceText: payload.insuranceText || payload.insurance_text || payload.insurance_desc || '',
    groupList: Array.isArray(payload.groupList || payload.group_list)
      ? (payload.groupList || payload.group_list).map(item => ({
          ...item,
          groupId: item.groupId || item.group_id || '',
          status: item.status || '',
          currentCount: Number(item.currentCount ?? item.current_count) || 0,
          targetCount: Number(item.targetCount ?? item.target_count) || 0,
          expireTime: item.expireTime || item.expire_time || ''
        }))
      : [],
    coach: payload.coach || {
      name: payload.coach_name || '教练待定',
      intro: payload.coach_intro || '',
      certificates: payload.coach_certificates || []
    }
  }
}

const normalizeUserGroupListItem = item => ({
  ...item,
  groupId: item.groupId || item.group_id || '',
  courseId: item.courseId || item.course_id || '',
  title: item.title || item.course_title || item.name || '',
  locationText: item.locationText || item.location || item.address || '',
  status: item.status || '',
  courseStatusText: item.courseStatusText || item.course_status_text || '',
  statusText:
    item.statusText ||
    (item.status === 'ongoing'
      ? '进行中'
      : item.status === 'success'
        ? '已成团'
        : item.status === 'failed'
          ? '已失败'
          : ''),
  currentCount: Number(item.currentCount ?? item.current_count) || 0,
  targetCount: Number(item.targetCount ?? item.target_count) || 0,
  expireTime: item.expireTime || item.expire_time || ''
})

const normalizeGroupDetail = payload => {
  if (!payload) {
    return payload
  }

  return {
    ...payload,
    groupId: payload.groupId || payload.group_id || '',
    courseId: payload.courseId || payload.course_id || '',
    courseStatusText: payload.courseStatusText || payload.course_status_text || '',
    currentCount: Number(payload.currentCount ?? payload.current_count) || 0,
    targetCount: Number(payload.targetCount ?? payload.target_count) || 0,
    members: payload.members || [],
    courseInfo: payload.courseInfo
      ? {
          ...payload.courseInfo,
          title: payload.courseInfo.title || payload.courseInfo.name || '',
          locationText: payload.courseInfo.locationText || payload.courseInfo.location || payload.courseInfo.address || '',
          joinedCount: Number(payload.courseInfo.joinedCount ?? payload.current_count) || 0,
          targetCount: Number(payload.courseInfo.targetCount ?? payload.target_count) || 0,
          groupPriceText:
            payload.courseInfo.groupPriceText !== undefined
              ? `${payload.courseInfo.groupPriceText}`
              : formatYuanPrice(payload.courseInfo.groupPrice ?? payload.courseInfo.group_price),
          originalPriceText:
            payload.courseInfo.originalPriceText !== undefined
              ? `${payload.courseInfo.originalPriceText}`
              : formatYuanPrice(payload.courseInfo.originalPrice ?? payload.courseInfo.original_price)
        }
      : payload.courseInfo
  }
}

const mapUserGroupListItem = groupDetail => ({
  groupId: groupDetail.groupId,
  courseId: groupDetail.courseId,
  status: groupDetail.status,
  courseStatusText: groupDetail.courseStatusText || '',
  statusText:
    groupDetail.status === 'ongoing'
      ? '进行中'
      : groupDetail.status === 'success'
        ? '已成团'
        : '已失败'
})

module.exports = {
  mapCourseListItem,
  mapCourseDetail,
  mapGroupDetail,
  formatYuanPrice,
  normalizeListPayload,
  normalizeActiveGroup,
  normalizeCourseListItem,
  normalizeCourseDetail,
  normalizeUserGroupListItem,
  normalizeGroupDetail,
  mapUserGroupListItem
}
