const { normalizeGroupStatus } = require('../domain/groupRules')
const { formatCourseTimeRange, getRemainingSeconds, formatPrice } = require('../utils/formatters')

const SERVICE_QR_CODE = 'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D%E4%BA%8C%E7%BB%B4%E7%A0%81'

const GROUP_RULE_NODES = [
  {
    name: 'ul',
    attrs: {
      style: 'padding-left: 30rpx;'
    },
    children: [
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '每个课程仅有一个进行中的拼团，先到先得。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '达到成团人数自动成团，未达到则自动原路退款。' }]
      }
    ]
  }
]

const PAYMENT_GROUP_NOTE_NODES = [
  {
    name: 'ul',
    attrs: {
      style: 'padding-left: 30rpx;'
    },
    children: [
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '每个课程仅开放一个进行中的拼团，请尽快完成支付。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '若截止前未成团，系统将自动原路退款。' }]
      }
    ]
  }
]

const normalizeImages = value => {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string' && value) {
    return [value]
  }

  return []
}

const buildDescriptionNodes = title => [
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 24rpx;'
    },
    children: [
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: `${title || '课程'}采用小班制教学，结合跑、跳、钻、爬与趣味游戏，让孩子在家门口也能完成系统的体适能训练。`
          }
        ]
      }
    ]
  }
]

const mapActiveGroup = (group, members) => ({
  groupId: group.id,
  courseId: group.course_id,
  status: normalizeGroupStatus(group.status),
  currentCount: Number(group.current_count) || 0,
  targetCount: Number(group.target_count) || 0,
  expireTime: group.expire_time,
  remainingSeconds: getRemainingSeconds(group.expire_time),
  members: members || []
})

const mapActiveGroupSummary = group => {
  if (!group) {
    return null
  }

  return {
    groupId: group.id,
    expireTime: group.expire_time,
    currentCount: Number(group.current_count) || 0,
    targetCount: Number(group.target_count) || 0
  }
}

const mapCourseGroupSummary = group => ({
  groupId: group.id,
  status: normalizeGroupStatus(group.status),
  currentCount: Number(group.current_count) || 0,
  targetCount: Number(group.target_count) || 0,
  expireTime: group.expire_time || ''
})

const summarizeSuccessGroupStats = groups => {
  return (groups || []).reduce((result, group) => {
    const current = result[group.course_id] || {
      completedGroupsCount: 0,
      successJoinedCount: 0
    }

    current.completedGroupsCount += 1
    current.successJoinedCount += Number(group.current_count) || 0
    result[group.course_id] = current
    return result
  }, {})
}

const buildActiveGroupMap = groups => {
  return (groups || []).reduce((result, group) => {
    if (!result[group.course_id]) {
      result[group.course_id] = mapActiveGroupSummary(group)
    }
    return result
  }, {})
}

const mapCourseListItem = (course, activeGroup, successStats) => ({
  id: course.id,
  cover: course.cover,
  name: course.name,
  address: course.address,
  start_time: course.start_time,
  group_price: Number(course.group_price || 0),
  original_price: Number(course.original_price || 0),
  maxGroups: Number(course.max_groups) || 0,
  completedGroupsCount: Number(successStats.completedGroupsCount) || 0,
  successJoinedCount: Number(successStats.successJoinedCount) || 0,
  activeGroup
})

const mapCourseDetail = (course, activeGroup, completedGroupsCount, successJoinedCount, groupList) => ({
  id: course.id,
  title: course.name || '',
  images: normalizeImages(course.images).length ? normalizeImages(course.images) : [course.cover || ''],
  groupPriceFen: Number(course.group_price) || 0,
  groupPriceText: formatPrice(course.group_price),
  originalPriceText: formatPrice(course.original_price),
  targetCount: Number(activeGroup && activeGroup.target_count) || 0,
  joinedCount: Number(activeGroup && activeGroup.current_count) || 0,
  maxGroups: Number(course.max_groups) || 0,
  completedGroupsCount: Number(completedGroupsCount) || 0,
  successJoinedCount: Number(successJoinedCount) || 0,
  activeGroup: mapActiveGroupSummary(activeGroup),
  groupList: groupList || [],
  timeText: formatCourseTimeRange(course.start_time),
  locationText: course.address || '',
  ageRange: course.age_limit || '',
  descriptionHtml: course.description || '',
  descriptionNodes: buildDescriptionNodes(course.name),
  groupRuleNodes: GROUP_RULE_NODES,
  paymentGroupNoteNodes: PAYMENT_GROUP_NOTE_NODES,
  coach: {
    name: course.coach_name || '教练待定',
    intro: course.coach_intro || '',
    certificates: normalizeImages(course.coach_certificates)
  },
  insuranceText:
    course.insurance_desc ||
    '本课程赠送运动意外险，由平台统一购买，为孩子提供基础运动安全保障。',
  serviceQrCode: course.service_qr_code || SERVICE_QR_CODE
})

module.exports = {
  buildActiveGroupMap,
  mapActiveGroup,
  mapActiveGroupSummary,
  mapCourseDetail,
  mapCourseGroupSummary,
  mapCourseListItem,
  normalizeImages,
  summarizeSuccessGroupStats
}
