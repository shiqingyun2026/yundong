const express = require('express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { COURSE_STATUS, getSingleCourseLifecycle, safeDate } = require('../utils/courseLifecycle')

const router = express.Router()

const normalizeGroupStatus = status => {
  if (status === 'active') {
    return 'ongoing'
  }

  if (status === 'success') {
    return 'success'
  }

  return 'failed'
}

const hasUserJoinedCourseGroup = async ({ userId, courseId }) => {
  const { data: successGroups, error: groupsError } = await supabase
    .from('groups')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'success')

  if (groupsError) {
    throw groupsError
  }

  const groupIds = (successGroups || []).map(item => item.id).filter(Boolean)

  if (groupIds.length) {
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .in('group_id', groupIds)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (membership) {
      return true
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('status', 'success')
    .limit(1)
    .maybeSingle()

  if (orderError) {
    throw orderError
  }

  return !!order
}

router.post('/', authenticate, async (req, res) => {
  const { courseId, groupId } = req.body || {}

  if (!courseId) {
    return res.status(400).json({
      message: 'courseId is required'
    })
  }

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError) {
      console.error('[orders] course query failed', {
        courseId,
        error: courseError
      })
      throw courseError
    }

    if (!course) {
      return res.status(404).json({
        message: 'course not found'
      })
    }

    const lifecycle = await getSingleCourseLifecycle(courseId)
    if (lifecycle.status !== COURSE_STATUS.GROUPING) {
      return res.status(400).json({
        message: '当前课程不在可拼团状态'
      })
    }

    const unpublishAt = safeDate(course.unpublish_time)
    if (unpublishAt && unpublishAt.getTime() <= Date.now()) {
      return res.status(400).json({
        message: '当前课程已下架'
      })
    }

    const userHasJoinedCourseGroup = await hasUserJoinedCourseGroup({
      userId: req.userId,
      courseId
    })

    if (userHasJoinedCourseGroup) {
      return res.status(400).json({
        message: '你已参加过该课程的拼团，不能重复参加'
      })
    }

    let finalGroup = null

    if (groupId) {
      const { data: existingGroup, error: groupError } = await supabase
        .from('groups')
        .select('id, course_id, status, current_count, target_count, expire_time')
        .eq('id', groupId)
        .maybeSingle()

      if (groupError) {
        console.error('[orders] existing group query failed', {
          courseId,
          groupId,
          error: groupError
        })
        throw groupError
      }

      if (!existingGroup) {
        return res.status(404).json({
          message: 'group not found'
        })
      }

      if (existingGroup.course_id !== courseId) {
        return res.status(400).json({
          message: 'group does not belong to the course'
        })
      }

      const expireAt = safeDate(existingGroup.expire_time)
      if (existingGroup.status !== 'active' || !expireAt || expireAt.getTime() <= Date.now()) {
        return res.status(400).json({
          message: 'group is not active'
        })
      }

      finalGroup = existingGroup
    } else {
      const targetCount = Number(course.default_target_count) || 2

      const { data: activeGroup, error: activeGroupError } = await supabase
        .from('groups')
        .select('id')
        .eq('course_id', courseId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (activeGroupError) {
        console.error('[orders] active group query failed', {
          courseId,
          userId: req.userId,
          error: activeGroupError
        })
        throw activeGroupError
      }

      if (activeGroup) {
        return res.status(400).json({
          message: '当前课程还有进行中的拼团，请先完成'
        })
      }

      const { count: completedGroupsCount, error: completedGroupsCountError } = await supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('status', 'success')

      if (completedGroupsCountError) {
        console.error('[orders] completed groups count query failed', {
          courseId,
          userId: req.userId,
          error: completedGroupsCountError
        })
        throw completedGroupsCountError
      }

      if ((Number(completedGroupsCount) || 0) >= (Number(course.max_groups) || 0)) {
        return res.status(400).json({
          message: '该课程已达开团上限'
        })
      }

      if (!course.deadline) {
        return res.status(400).json({
          message: '当前课程未配置报名截止时间，无法创建拼团'
        })
      }

      const { data: createdGroup, error: createGroupError } = await supabase
        .from('groups')
        .insert({
          course_id: courseId,
          creator_id: req.userId,
          status: 'active',
          current_count: 0,
          target_count: targetCount,
          expire_time: course.deadline
        })
        .select('id, course_id, status, current_count, target_count, expire_time')
        .single()

      if (createGroupError) {
        console.error('[orders] create group failed', {
          courseId,
          userId: req.userId,
          error: createGroupError
        })
        throw createGroupError
      }

      finalGroup = createdGroup
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: req.userId,
        course_id: courseId,
        group_id: finalGroup.id,
        amount: Number(course.group_price) || 0
      })
      .select('id, user_id, course_id, group_id, amount')
      .single()

    if (orderError) {
      console.error('[orders] create order record failed', {
        courseId,
        groupId: finalGroup && finalGroup.id,
        userId: req.userId,
        error: orderError
      })
      throw orderError
    }

    return res.json({
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      amount: Number(order.amount) || 0,
      paymentParams: {},
      alreadyJoined: false,
      groupStatus: normalizeGroupStatus(finalGroup.status)
    })
  } catch (error) {
    console.error('[orders] failed to create order', {
      userId: req.userId,
      courseId,
      groupId,
      error
    })
    return res.status(500).json({
      message: error.message || 'failed to create order'
    })
  }
})

module.exports = router
