const express = require('express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')

const router = express.Router()

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getExpireTimeAfterHours = hours => {
  const expireAt = new Date(Date.now() + hours * 3600 * 1000)
  return expireAt.toISOString()
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

const hasUserJoinedCourseGroup = async ({ userId, courseId }) => {
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id')
    .eq('course_id', courseId)

  if (groupsError) {
    throw groupsError
  }

  const groupIds = (groups || []).map(item => item.id).filter(Boolean)

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
    .limit(1)
    .maybeSingle()

  if (orderError) {
    throw orderError
  }

  return !!order
}

const markGroupOrdersSuccess = async groupId => {
  try {
    await supabase
      .from('orders')
      .update({
        status: 'success'
      })
      .eq('group_id', groupId)
  } catch (error) {
    // Ignore optional order status synchronization failures for now.
  }
}

router.post('/', authenticate, async (req, res) => {
  const { courseId, groupId } = req.body || {}
  const defaultTargetCount = 2

  if (!courseId) {
    return res.status(400).json({
      message: 'courseId is required'
    })
  }

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, group_price')
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

      const { error: insertMemberError } = await supabase
        .from('group_members')
        .insert({
          group_id: existingGroup.id,
          user_id: req.userId
        })

      if (insertMemberError) {
        console.error('[orders] insert group member failed', {
          courseId,
          groupId: existingGroup.id,
          userId: req.userId,
          error: insertMemberError
        })
        throw insertMemberError
      }

      const nextCount = (Number(existingGroup.current_count) || 0) + 1
      const shouldSuccess = nextCount >= (Number(existingGroup.target_count) || defaultTargetCount)

      const { data: updatedGroup, error: updateGroupError } = await supabase
        .from('groups')
        .update({
          current_count: nextCount,
          status: shouldSuccess ? 'success' : existingGroup.status
        })
        .eq('id', existingGroup.id)
        .select('id, course_id, status, current_count, target_count, expire_time')
        .single()

      if (updateGroupError) {
        console.error('[orders] update group count failed', {
          courseId,
          groupId: existingGroup.id,
          nextCount,
          error: updateGroupError
        })
        throw updateGroupError
      }

      finalGroup = updatedGroup

      if (shouldSuccess) {
        await markGroupOrdersSuccess(existingGroup.id)
      }
    } else {
      const targetCount = defaultTargetCount

      const { data: createdGroup, error: createGroupError } = await supabase
        .from('groups')
        .insert({
          course_id: courseId,
          creator_id: req.userId,
          status: 'active',
          current_count: 1,
          target_count: targetCount,
          expire_time: getExpireTimeAfterHours(24)
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

      const { error: insertMemberError } = await supabase
        .from('group_members')
        .insert({
          group_id: createdGroup.id,
          user_id: req.userId
        })

      if (insertMemberError) {
        console.error('[orders] insert creator member failed', {
          courseId,
          groupId: createdGroup.id,
          userId: req.userId,
          error: insertMemberError
        })
        throw insertMemberError
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
