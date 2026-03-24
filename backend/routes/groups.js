const express = require('express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')

const router = express.Router()

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

const normalizeGroupStatus = status => {
  if (status === 'active') {
    return 'ongoing'
  }

  if (status === 'success') {
    return 'success'
  }

  return 'failed'
}

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', req.params.id)
      .eq('user_id', req.userId)
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (!membership) {
      return res.status(403).json({
        message: 'Forbidden'
      })
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, course_id, status, current_count, target_count, expire_time, refund_desc')
      .eq('id', req.params.id)
      .maybeSingle()

    if (groupError) {
      throw groupError
    }

    if (!group) {
      return res.status(404).json({
        message: 'group not found'
      })
    }

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id, users(nickname, avatar_url)')
      .eq('group_id', group.id)

    if (membersError) {
      throw membersError
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, cover, address, start_time, group_price, original_price, target_count, age_limit, service_qr_code')
      .eq('id', group.course_id)
      .maybeSingle()

    if (courseError) {
      throw courseError
    }

    if (!course) {
      return res.status(404).json({
        message: 'course not found'
      })
    }

    const deadlineTime = safeDate(course.start_time)
      ? new Date(new Date(course.start_time).getTime() - 12 * 3600 * 1000)
      : null

    return res.json({
      groupId: group.id,
      courseId: group.course_id,
      status: normalizeGroupStatus(group.status),
      currentCount: Number(group.current_count) || 0,
      targetCount: Number(group.target_count) || Number(course.target_count) || 0,
      remainingSeconds: getRemainingSeconds(group.expire_time),
      expireTime: group.expire_time,
      refundDesc: group.refund_desc || '截止时间未成团将自动原路退款',
      deadlineText: deadlineTime ? formatTime(deadlineTime) : '',
      userJoined: true,
      members: (members || []).map(item => ({
        avatar: (item.users && item.users.avatar_url) || '',
        nickName: (item.users && item.users.nickname) || '微信用户'
      })),
      courseInfo: {
        id: course.id,
        title: course.name || '',
        groupPriceText: formatPrice(course.group_price),
        originalPriceText: formatPrice(course.original_price),
        targetCount: Number(course.target_count) || 0,
        joinedCount: Number(group.current_count) || 0,
        timeText: formatCourseTimeRange(course.start_time),
        locationText: course.address || '',
        ageRange: course.age_limit || '',
        cover: course.cover || '',
        serviceQrCode: course.service_qr_code || ''
      }
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch group detail'
    })
  }
})

module.exports = router
