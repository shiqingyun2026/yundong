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

  if (!courseId) {
    return res.status(400).json({
      message: 'courseId is required'
    })
  }

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, target_count, group_price')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError) {
      throw courseError
    }

    if (!course) {
      return res.status(404).json({
        message: 'course not found'
      })
    }

    let finalGroup = null
    let alreadyJoined = false

    if (groupId) {
      const { data: existingGroup, error: groupError } = await supabase
        .from('groups')
        .select('id, course_id, status, current_count, target_count, expire_time')
        .eq('id', groupId)
        .maybeSingle()

      if (groupError) {
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

      const { data: membership, error: membershipError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', existingGroup.id)
        .eq('user_id', req.userId)
        .maybeSingle()

      if (membershipError) {
        throw membershipError
      }

      alreadyJoined = !!membership

      if (!alreadyJoined) {
        const { error: insertMemberError } = await supabase
          .from('group_members')
          .insert({
            group_id: existingGroup.id,
            user_id: req.userId
          })

        if (insertMemberError) {
          throw insertMemberError
        }

        const nextCount = (Number(existingGroup.current_count) || 0) + 1
        const shouldSuccess = nextCount >= (Number(existingGroup.target_count) || Number(course.target_count) || 2)

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
          throw updateGroupError
        }

        finalGroup = updatedGroup

        if (shouldSuccess) {
          await markGroupOrdersSuccess(existingGroup.id)
        }
      } else {
        finalGroup = existingGroup
      }
    } else {
      const targetCount = Number(course.target_count) || 2

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
        throw createGroupError
      }

      const { error: insertMemberError } = await supabase
        .from('group_members')
        .insert({
          group_id: createdGroup.id,
          user_id: req.userId
        })

      if (insertMemberError) {
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
      throw orderError
    }

    return res.json({
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      amount: Number(order.amount) || 0,
      paymentParams: {},
      alreadyJoined,
      groupStatus: normalizeGroupStatus(finalGroup.status)
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to create order'
    })
  }
})

module.exports = router
