const express = require('express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')

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

const markGroupOrdersSuccess = async groupId => {
  try {
    await supabase
      .from('orders')
      .update({
        status: 'success'
      })
      .eq('group_id', groupId)
  } catch (error) {
    console.error('[payments/mock-success] mark group orders success failed', {
      groupId,
      error
    })
  }
}

router.post('/mock-success', authenticate, async (req, res) => {
  const { orderId, groupId } = req.body || {}

  if (!orderId) {
    return res.status(400).json({
      message: 'orderId is required'
    })
  }

  try {
    const { data: order, error: orderQueryError } = await supabase
      .from('orders')
      .select('id, user_id, course_id, group_id')
      .eq('id', orderId)
      .eq('user_id', req.userId)
      .maybeSingle()

    if (orderQueryError) {
      console.error('[payments/mock-success] order query failed', {
        orderId,
        userId: req.userId,
        error: orderQueryError
      })
      throw orderQueryError
    }

    if (!order) {
      return res.status(404).json({
        message: 'order not found'
      })
    }

    const targetGroupId = order.group_id || groupId || ''
    let currentCount = 0
    let targetCount = 0
    let groupStatus = 'failed'

    if (targetGroupId) {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, status, current_count, target_count')
        .eq('id', targetGroupId)
        .maybeSingle()

      if (groupError) {
        console.error('[payments/mock-success] group query failed', {
          orderId,
          groupId: targetGroupId,
          error: groupError
        })
        throw groupError
      }

      if (group) {
        currentCount = Number(group.current_count) || 0
        targetCount = Number(group.target_count) || 0
        groupStatus = normalizeGroupStatus(group.status)

        const { data: membership, error: membershipError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('group_id', group.id)
          .eq('user_id', req.userId)
          .maybeSingle()

        if (membershipError) {
          console.error('[payments/mock-success] membership query failed', {
            orderId,
            groupId: group.id,
            userId: req.userId,
            error: membershipError
          })
          throw membershipError
        }

        let nextCount = currentCount

        if (!membership) {
          const { error: insertMemberError } = await supabase
            .from('group_members')
            .insert({
              group_id: group.id,
              user_id: req.userId
            })

          if (insertMemberError) {
            console.error('[payments/mock-success] insert member failed', {
              orderId,
              groupId: group.id,
              userId: req.userId,
              error: insertMemberError
            })
            throw insertMemberError
          }

          nextCount += 1
        }

        const shouldSuccess = targetCount > 0 && nextCount >= targetCount
        const nextStatus = shouldSuccess ? 'success' : group.status

        if (!membership || nextStatus !== group.status) {
          const { data: updatedGroup, error: updateGroupError } = await supabase
            .from('groups')
            .update({
              current_count: nextCount,
              status: nextStatus
            })
            .eq('id', group.id)
            .select('id, status, current_count, target_count')
            .single()

          if (updateGroupError) {
            console.error('[payments/mock-success] update group failed', {
              orderId,
              groupId: group.id,
              nextCount,
              nextStatus,
              error: updateGroupError
            })
            throw updateGroupError
          }

          currentCount = Number(updatedGroup.current_count) || 0
          targetCount = Number(updatedGroup.target_count) || 0
          groupStatus = normalizeGroupStatus(updatedGroup.status)

          if (updatedGroup.status === 'success') {
            await markGroupOrdersSuccess(group.id)
          }
        }
      }
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'success'
      })
      .eq('id', order.id)
      .eq('user_id', req.userId)

    if (orderUpdateError) {
      console.error('[payments/mock-success] update order failed', {
        orderId,
        userId: req.userId,
        error: orderUpdateError
      })
      throw orderUpdateError
    }

    return res.json({
      orderId: order.id,
      courseId: order.course_id,
      groupId: targetGroupId,
      groupStatus,
      currentCount,
      targetCount
    })
  } catch (error) {
    console.error('[payments/mock-success] failed', {
      orderId,
      groupId,
      userId: req.userId,
      error
    })
    return res.status(500).json({
      message: error.message || 'failed to mark payment success'
    })
  }
})

module.exports = router
