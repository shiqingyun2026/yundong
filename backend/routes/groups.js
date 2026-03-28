const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { COURSE_STATUS, getSingleCourseLifecycle } = require('../utils/courseLifecycle')

const router = express.Router()

const pad = value => `${value}`.padStart(2, '0')

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatPrice = value => Number(value || 0).toFixed(2)

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

const getCourseStageText = (groupStatus, courseLifecycleStatus) => {
  if (groupStatus !== 'success') {
    return ''
  }

  return Number(courseLifecycleStatus) === COURSE_STATUS.FINISHED ? '已结课' : '等待上课'
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
      console.error('[groups/:id] membership query failed', {
        groupId: req.params.id,
        userId: req.userId,
        error: membershipError
      })
      throw membershipError
    }

    if (!membership) {
      return res.status(403).json({
        message: 'You are not a member of this group'
      })
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, course_id, status, current_count, target_count, expire_time')
      .eq('id', req.params.id)
      .maybeSingle()

    if (groupError) {
      console.error('[groups/:id] group query failed', {
        groupId: req.params.id,
        error: groupError
      })
      throw groupError
    }

    if (!group) {
      return res.status(404).json({
        message: 'group not found'
      })
    }

    const { data: memberRows, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)

    if (membersError) {
      console.error('[groups/:id] group members query failed', {
        groupId: group.id,
        error: membersError
      })
      throw membersError
    }

    const userIds = (memberRows || []).map(item => item.user_id).filter(Boolean)
    let usersById = {}

    if (userIds.length) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, nickname, avatar_url')
        .in('id', userIds)

      if (usersError) {
        console.error('[groups/:id] users query failed', {
          groupId: group.id,
          userIds,
          error: usersError
        })
      } else {
        usersById = (users || []).reduce((result, user) => {
          result[user.id] = user
          return result
        }, {})
      }
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, cover, address, start_time, group_price, original_price')
      .eq('id', group.course_id)
      .maybeSingle()

    if (courseError) {
      console.error('[groups/:id] course query failed', {
        groupId: group.id,
        courseId: group.course_id,
        error: courseError
      })
      throw courseError
    }

    if (!course) {
      return res.status(404).json({
        message: 'course not found'
      })
    }

    const lifecycle = await getSingleCourseLifecycle(course.id)

    const deadlineTime = safeDate(group.expire_time)

    return res.json({
      groupId: group.id,
      courseId: group.course_id,
      status: normalizeGroupStatus(group.status),
      courseStatusText: getCourseStageText(group.status, lifecycle.status),
      currentCount: Number(group.current_count) || 0,
      targetCount: Number(group.target_count) || 0,
      remainingSeconds: getRemainingSeconds(group.expire_time),
      expireTime: group.expire_time,
      refundDesc: '报名截止时间未成团将自动原路退款',
      deadlineText: deadlineTime ? formatTime(deadlineTime) : '',
      userJoined: true,
      members: (memberRows || []).map(item => ({
        avatar: (usersById[item.user_id] && usersById[item.user_id].avatar_url) || '',
        nickName: (usersById[item.user_id] && usersById[item.user_id].nickname) || '微信用户'
      })),
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
  } catch (error) {
    console.error('[groups/:id] failed to fetch group detail', {
      groupId: req.params.id,
      userId: req.userId,
      error
    })
    return res.status(500).json({
      message: error.message || 'failed to fetch group detail'
    })
  }
})

module.exports = router
