const express = require('express')

const supabase = require('../utils/supabase')

const router = express.Router()

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

const pad = value => `${value}`.padStart(2, '0')

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatPrice = value => (Number(value || 0) / 100).toFixed(2)

const formatTime = value => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatCourseTimeRange = (startTime, endTime) => {
  const startDate = safeDate(startTime)
  const endDate = safeDate(endTime)

  if (!startDate || !endDate) {
    return '时间待定'
  }

  const weekMap = ['日', '一', '二', '三', '四', '五', '六']

  return `${pad(startDate.getMonth() + 1)}月${pad(startDate.getDate())}日 周${weekMap[startDate.getDay()]} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}-${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
}

const formatDistance = distance => {
  const numericDistance = Number(distance)
  if (Number.isNaN(numericDistance)) {
    return ''
  }

  if (numericDistance < 1) {
    return `${Math.round(numericDistance * 1000)}m`
  }

  return `${numericDistance.toFixed(1)}km`
}

const getRemainingSeconds = expireTime => {
  const expireAt = safeDate(expireTime)
  if (!expireAt) {
    return 0
  }

  return Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000))
}

const normalizeImages = value => {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string' && value) {
    return [value]
  }

  return []
}

const mapCourseListItem = (course, activeGroup) => {
  const joinedCount = Number(activeGroup && activeGroup.current_count) || 0
  const targetCount = Number(course.target_count) || 0

  return {
    id: course.id,
    cover: course.cover || '',
    title: course.title || '',
    timeText: formatCourseTimeRange(course.start_time, course.end_time),
    locationText: course.location || '',
    groupPriceText: formatPrice(course.group_price),
    originalPriceText: formatPrice(course.original_price),
    joinedCount,
    distanceText: formatDistance(course.distance_km),
    startTimestamp: safeDate(course.start_time) ? new Date(course.start_time).getTime() : 0,
    soonGroup: joinedCount > 0 && targetCount > 0 && joinedCount >= targetCount - 1
  }
}

const mapCourseDetail = (course, activeGroup) => ({
  id: course.id,
  title: course.title || '',
  images: normalizeImages(course.images).length ? normalizeImages(course.images) : [course.cover || ''],
  groupPriceFen: Number(course.group_price) || 0,
  groupPriceText: formatPrice(course.group_price),
  originalPriceText: formatPrice(course.original_price),
  targetCount: Number(course.target_count) || 0,
  joinedCount: Number(activeGroup && activeGroup.current_count) || 0,
  timeText: formatCourseTimeRange(course.start_time, course.end_time),
  locationText: course.location || '',
  ageRange: course.age_range || '',
  descriptionNodes: buildDescriptionNodes(course.title),
  groupRuleNodes: GROUP_RULE_NODES,
  paymentGroupNoteNodes: PAYMENT_GROUP_NOTE_NODES,
  coach: {
    name: course.coach_name || '教练待定',
    intro: course.coach_intro || '',
    certificates: normalizeImages(course.coach_certificates)
  },
  insuranceText:
    course.insurance_text ||
    '本课程赠送运动意外险，由平台统一购买，为孩子提供基础运动安全保障。',
  serviceQrCode: course.service_qr_code || SERVICE_QR_CODE
})

const mapActiveGroup = (group, members) => ({
  groupId: group.id,
  courseId: group.course_id,
  currentCount: Number(group.current_count) || 0,
  targetCount: Number(group.target_count) || 0,
  expireTime: group.expire_time,
  remainingSeconds: getRemainingSeconds(group.expire_time),
  members: (members || []).map(item => ({
    avatar: (item.users && item.users.avatar_url) || '',
    nickName: (item.users && item.users.nickname) || '微信用户'
  }))
})

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.max(1, Number(req.query.pageSize) || 10)
  const sort = req.query.sort === 'time' ? 'time' : 'distance'
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  try {
    const { data: courses, count, error } = await supabase
      .from('courses')
      .select(
        'id, cover, title, start_time, end_time, location, group_price, original_price, target_count, distance_km, created_at',
        { count: 'exact' }
      )
      .order(sort === 'time' ? 'start_time' : 'created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    const courseIds = (courses || []).map(item => item.id)
    let activeGroupMap = {}

    if (courseIds.length) {
      const { data: activeGroups, error: activeGroupsError } = await supabase
        .from('groups')
        .select('id, course_id, current_count, target_count, expire_time')
        .in('course_id', courseIds)
        .eq('status', 'active')
        .gt('expire_time', new Date().toISOString())

      if (activeGroupsError) {
        throw activeGroupsError
      }

      activeGroupMap = (activeGroups || []).reduce((result, item) => {
        result[item.course_id] = item
        return result
      }, {})
    }

    const list = (courses || []).map(item => mapCourseListItem(item, activeGroupMap[item.id]))

    return res.json({
      data: list,
      list,
      total: count || 0,
      page,
      pageSize,
      hasMore: from + list.length < (count || 0)
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch courses'
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select(
        'id, title, cover, images, start_time, end_time, location, group_price, original_price, target_count, age_range, coach_name, coach_intro, coach_certificates, insurance_text, service_qr_code'
      )
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!course) {
      return res.status(404).json({
        message: 'course not found'
      })
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

    return res.json(mapCourseDetail(course, activeGroup))
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch course detail'
    })
  }
})

router.get('/:id/active-group', async (req, res) => {
  try {
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, course_id, current_count, target_count, expire_time, status')
      .eq('course_id', req.params.id)
      .eq('status', 'active')
      .gt('expire_time', new Date().toISOString())
      .order('expire_time', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!group) {
      return res.json(null)
    }

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id, users(nickname, avatar_url)')
      .eq('group_id', group.id)

    if (membersError) {
      throw membersError
    }

    return res.json(mapActiveGroup(group, members))
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch active group'
    })
  }
})

module.exports = router
