const express = require('express')
const jwt = require('jsonwebtoken')

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

const formatTime = value => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatCourseTimeRange = (startTime, endTime = startTime) => {
  const startDate = safeDate(startTime)
  const endDate = safeDate(endTime)

  if (!startDate || !endDate) {
    return '时间待定'
  }

  const weekMap = ['日', '一', '二', '三', '四', '五', '六']

  return `${pad(startDate.getMonth() + 1)}月${pad(startDate.getDate())}日 周${weekMap[startDate.getDay()]} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}-${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
}

const getRemainingSeconds = expireTime => {
  const expireAt = safeDate(expireTime)
  if (!expireAt) {
    return 0
  }

  return Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000))
}

const resolveUserIdFromRequest = req => {
  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token || !process.env.JWT_SECRET) {
    return ''
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return (payload && payload.userId) || ''
  } catch (error) {
    return ''
  }
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

const fetchGroupMembers = async groupId => {
  const { data: memberRows, error: memberRowsError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)

  if (memberRowsError) {
    throw memberRowsError
  }

  const userIds = (memberRows || []).map(item => item.user_id).filter(Boolean)
  if (!userIds.length) {
    return []
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, nickname, avatar_url')
    .in('id', userIds)

  if (usersError) {
    throw usersError
  }

  const usersById = (users || []).reduce((result, user) => {
    result[user.id] = user
    return result
  }, {})

  return (memberRows || []).map(item => ({
    avatar: (usersById[item.user_id] && usersById[item.user_id].avatar_url) || '',
    nickName: (usersById[item.user_id] && usersById[item.user_id].nickname) || '微信用户'
  }))
}

const mapCourseDetail = (course, activeGroup) => ({
  id: course.id,
  title: course.name || '',
  images: normalizeImages(course.images).length ? normalizeImages(course.images) : [course.cover || ''],
  groupPriceFen: Number(course.group_price) || 0,
  groupPriceText: Number(course.group_price || 0).toFixed(2),
  originalPriceText: Number(course.original_price || 0).toFixed(2),
  targetCount: Number(activeGroup && activeGroup.target_count) || 0,
  joinedCount: Number(activeGroup && activeGroup.current_count) || 0,
  timeText: formatCourseTimeRange(course.start_time),
  locationText: course.address || '',
  ageRange: course.age_limit || '',
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

const mapActiveGroup = (group, members) => ({
  groupId: group.id,
  courseId: group.course_id,
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
        'id, cover, name, address, start_time, group_price, original_price',
        { count: 'exact' }
      )
      .order('start_time', { ascending: sort === 'time' })
      .range(from, to)

    if (error) {
      throw error
    }

    const courseIds = (courses || []).map(item => item.id).filter(Boolean)
    let activeGroupMap = {}

    if (courseIds.length) {
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, course_id, expire_time, current_count, target_count')
        .in('course_id', courseIds)
        .eq('status', 'active')
        .gt('expire_time', new Date().toISOString())
        .order('expire_time', { ascending: true })

      if (groupsError) {
        throw groupsError
      }

      activeGroupMap = (groups || []).reduce((result, group) => {
        if (!result[group.course_id]) {
          result[group.course_id] = mapActiveGroupSummary(group)
        }
        return result
      }, {})
    }

    const list = (courses || []).map(item => {
      const activeGroup = activeGroupMap[item.id] || null

      return {
        id: item.id,
        cover: item.cover,
        name: item.name,
        address: item.address,
        start_time: item.start_time,
        group_price: Number(item.group_price || 0),
        original_price: Number(item.original_price || 0),
        activeGroup
      }
    })

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
        'id, name, cover, images, address, start_time, group_price, original_price, age_limit, coach_name, coach_intro, coach_certificates, insurance_desc, service_qr_code'
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

    const members = await fetchGroupMembers(group.id)
    const userId = resolveUserIdFromRequest(req)
    let userJoined = false

    if (userId) {
      const { data: membership, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (membershipError) {
        throw membershipError
      }

      userJoined = !!membership
    }

    return res.json({
      ...mapActiveGroup(group, members),
      userJoined
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch active group'
    })
  }
})

module.exports = router
