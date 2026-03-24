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

const formatCourseTimeRange = (startTime, endTime = startTime) => {
  const startDate = safeDate(startTime)
  const endDate = safeDate(endTime)

  if (!startDate || !endDate) {
    return '时间待定'
  }

  const weekMap = ['日', '一', '二', '三', '四', '五', '六']

  return `${pad(startDate.getMonth() + 1)}月${pad(startDate.getDate())}日 周${weekMap[startDate.getDay()]} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}-${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
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

const normalizeStatus = status => {
  if (status === 'active') {
    return 'ongoing'
  }

  if (status === 'success') {
    return 'success'
  }

  return 'failed'
}

const getStatusText = status => {
  if (status === 'ongoing') {
    return '进行中'
  }

  if (status === 'success') {
    return '已成团'
  }

  return '已失败'
}

router.get('/groups', authenticate, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.max(1, Number(req.query.pageSize) || 10)
  const status = normalizeStatusFilter(req.query.status)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  try {
    let query = supabase
      .from('group_members')
      .select(
        'group_id, joined_at, groups!inner(id, course_id, status, current_count, target_count, expire_time, courses!inner(id, cover, name, address, start_time))',
        { count: 'exact' }
      )
      .eq('user_id', req.userId)
      .order('joined_at', { ascending: false })
      .range(from, to)

    if (status) {
      query = query.eq('groups.status', status)
    }

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const list = (data || [])
      .map(item => {
        const group = Array.isArray(item.groups) ? item.groups[0] : item.groups
        const course = group && group.courses
          ? Array.isArray(group.courses)
            ? group.courses[0]
            : group.courses
          : null

        if (!group || !course) {
          return null
        }

        const normalizedStatus = normalizeStatus(group.status)

        return {
          groupId: group.id,
          courseId: group.course_id,
          cover: course.cover || '',
          title: course.name || '',
          timeText: formatCourseTimeRange(course.start_time),
          locationText: course.address || '',
          status: normalizedStatus,
          statusText: getStatusText(normalizedStatus),
          currentCount: Number(group.current_count) || 0,
          targetCount: Number(group.target_count) || 0,
          expireTime: group.expire_time || ''
        }
      })
      .filter(Boolean)

    return res.json({
      list,
      data: list,
      total: count || 0,
      page,
      pageSize,
      hasMore: from + list.length < (count || 0)
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch user groups'
    })
  }
})

module.exports = router
