const { COURSE_STATUS, getSingleCourseLifecycle, safeDate } = require('../../utils/courseLifecycle')
const {
  applyPaymentToGroup,
  applyRefundToGroup,
  buildGroupCreationPayload,
  canApplyPaymentToGroup,
  hasSuccessfulParticipation,
  isGroupJoinable
} = require('../domain/groupRules')

const createServiceError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const isServiceError = error => {
  return !!(error && Number.isInteger(error.status) && error.status >= 400)
}

const listPendingOrderIdsForCourse = async ({
  supabase,
  userId,
  courseId
}) => {
  const { data: pendingOrders, error: pendingOrdersError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('status', 'pending')

  if (pendingOrdersError) {
    throw pendingOrdersError
  }

  return (pendingOrders || []).map(item => item.id).filter(Boolean)
}

const closePendingOrdersByIds = async ({
  supabase,
  orderIds,
  now = new Date()
}) => {
  const ids = [...new Set((orderIds || []).filter(Boolean))]
  if (!ids.length) {
    return []
  }

  const timestamp = now.toISOString()
  const { data: closedOrders, error: closeOrdersError } = await supabase
    .from('orders')
    .update({
      status: 'closed',
      updated_at: timestamp
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id')

  if (closeOrdersError) {
    throw closeOrdersError
  }

  return closedOrders || []
}

const cleanupExpiredActiveGroupsForCourse = async ({
  supabase,
  courseId,
  now = new Date()
}) => {
  const timestamp = now.toISOString()
  const { data: expiredGroups, error: expiredGroupsError } = await supabase
    .from('groups')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'active')
    .lte('expire_time', timestamp)

  if (expiredGroupsError) {
    throw expiredGroupsError
  }

  const groupIds = (expiredGroups || []).map(item => item.id).filter(Boolean)
  if (!groupIds.length) {
    return []
  }

  const { error: updateGroupsError } = await supabase
    .from('groups')
    .update({
      status: 'failed'
    })
    .in('id', groupIds)

  if (updateGroupsError) {
    throw updateGroupsError
  }

  const { error: closePendingOrdersError } = await supabase
    .from('orders')
    .update({
      status: 'closed',
      updated_at: timestamp
    })
    .in('group_id', groupIds)
    .eq('status', 'pending')

  if (closePendingOrdersError) {
    throw closePendingOrdersError
  }

  const { data: paidOrders, error: paidOrdersError } = await supabase
    .from('orders')
    .select('id, user_id')
    .in('group_id', groupIds)
    .eq('status', 'success')

  if (paidOrdersError) {
    throw paidOrdersError
  }

  return {
    groupIds,
    paidOrders: paidOrders || []
  }
}

const getOrderForUser = async ({ supabase, userId, orderId }) => {
  const { data: order, error: orderQueryError } = await supabase
    .from('orders')
    .select('id, user_id, course_id, group_id, status, pay_time')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (orderQueryError) {
    throw orderQueryError
  }

  return order
}

const hasUserJoinedCourseGroup = async ({ supabase, userId, courseId }) => {
  const { data: successGroups, error: groupsError } = await supabase
    .from('groups')
    .select('id')
    .eq('course_id', courseId)
    .eq('status', 'success')

  if (groupsError) {
    throw groupsError
  }

  const groupIds = (successGroups || []).map(item => item.id).filter(Boolean)
  let successMembershipExists = false

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

    successMembershipExists = !!membership
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

  return hasSuccessfulParticipation({
    successMembershipExists,
    successOrderExists: !!order
  })
}

const createPendingOrder = async ({
  supabase,
  userId,
  courseId,
  groupId,
  now = new Date(),
  getCourseLifecycle = getSingleCourseLifecycle
}) => {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (courseError) {
    throw courseError
  }

  if (!course) {
    throw createServiceError(404, 'course not found')
  }

  const unpublishAt = safeDate(course.unpublish_time)
  if (unpublishAt && unpublishAt.getTime() <= now.getTime()) {
    throw createServiceError(400, '当前课程已下架')
  }

  const pendingOrderIdsToClose = await listPendingOrderIdsForCourse({
    supabase,
    userId,
    courseId
  })

  await cleanupExpiredActiveGroupsForCourse({
    supabase,
    courseId,
    now
  })

  const lifecycle = await getCourseLifecycle(courseId)
  if (lifecycle.status !== COURSE_STATUS.GROUPING) {
    throw createServiceError(400, '当前课程不在可拼团状态')
  }

  const userHasJoinedCourseGroup = await hasUserJoinedCourseGroup({
    supabase,
    userId,
    courseId
  })

  if (userHasJoinedCourseGroup) {
    throw createServiceError(400, '你已参加过该课程的拼团，不能重复参加')
  }

  let finalGroup = null

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
      throw createServiceError(404, 'group not found')
    }

    if (existingGroup.course_id !== courseId) {
      throw createServiceError(400, 'group does not belong to the course')
    }

    if (!isGroupJoinable(existingGroup, now)) {
      throw createServiceError(400, 'group is not active')
    }

    finalGroup = existingGroup
  } else {
    const { data: activeGroup, error: activeGroupError } = await supabase
      .from('groups')
      .select('id')
      .eq('course_id', courseId)
      .eq('status', 'active')
      .gt('expire_time', now.toISOString())
      .limit(1)
      .maybeSingle()

    if (activeGroupError) {
      throw activeGroupError
    }

    if (activeGroup) {
      throw createServiceError(400, '当前课程还有进行中的拼团，请先完成')
    }

    const { count: completedGroupsCount, error: completedGroupsCountError } = await supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('status', 'success')

    if (completedGroupsCountError) {
      throw completedGroupsCountError
    }

    if ((Number(completedGroupsCount) || 0) >= (Number(course.max_groups) || 0)) {
      throw createServiceError(400, '该课程已达开团上限')
    }

    if (!course.deadline) {
      throw createServiceError(400, '当前课程未配置报名截止时间，无法创建拼团')
    }

    const targetCount = Number(course.default_target_count) || 2
    const { data: createdGroup, error: createGroupError } = await supabase
      .from('groups')
      .insert(
        buildGroupCreationPayload({
          courseId,
          creatorId: userId,
          deadline: course.deadline,
          targetCount
        })
      )
      .select('id, course_id, status, current_count, target_count, expire_time')
      .single()

    if (createGroupError) {
      throw createGroupError
    }

    finalGroup = createdGroup
  }

  await closePendingOrdersByIds({
    supabase,
    orderIds: pendingOrderIdsToClose,
    now
  })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      course_id: courseId,
      group_id: finalGroup.id,
      amount: Number(course.group_price) || 0
    })
    .select('id, user_id, course_id, group_id, amount')
    .single()

  if (orderError) {
    if (orderError.code === '23505') {
      throw createServiceError(409, '当前课程订单正在创建中，请稍后重试')
    }

    throw orderError
  }

  return {
    course,
    group: finalGroup,
    order
  }
}

const markOrderPaymentSuccess = async ({
  supabase,
  userId,
  orderId,
  groupId,
  now = new Date()
}) => {
  let order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  await cleanupExpiredActiveGroupsForCourse({
    supabase,
    courseId: order.course_id,
    now
  })

  order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  if (order.status === 'refunded') {
    throw createServiceError(400, 'order is refunded')
  }

  if (order.status === 'closed') {
    throw createServiceError(400, 'order is closed')
  }

  const targetGroupId = order.group_id || groupId || ''
  let currentCount = 0
  let targetCount = 0
  let nextGroupStatus = 'failed'

  if (targetGroupId) {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, status, current_count, target_count, expire_time')
      .eq('id', targetGroupId)
      .maybeSingle()

    if (groupError) {
      throw groupError
    }

    if (!group) {
      throw createServiceError(404, 'group not found')
    }

    currentCount = Number(group.current_count) || 0
    targetCount = Number(group.target_count) || 0
    nextGroupStatus = group.status || 'failed'

    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (!canApplyPaymentToGroup({ group, membershipExists: !!membership, now })) {
      throw createServiceError(400, 'group is not active')
    }

    const paymentResult = applyPaymentToGroup({
      group,
      membershipExists: !!membership,
      now
    })

    if (paymentResult.membershipShouldCreate) {
      const { error: insertMemberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId
        })

      if (insertMemberError) {
        throw insertMemberError
      }
    }

    if (paymentResult.shouldUpdateGroup) {
      const { data: updatedGroup, error: updateGroupError } = await supabase
        .from('groups')
        .update({
          current_count: paymentResult.nextCount,
          status: paymentResult.nextStatus
        })
        .eq('id', group.id)
        .select('id, status, current_count, target_count')
        .single()

      if (updateGroupError) {
        throw updateGroupError
      }

      currentCount = Number(updatedGroup.current_count) || 0
      targetCount = Number(updatedGroup.target_count) || 0
      nextGroupStatus = updatedGroup.status || 'failed'
    } else {
      currentCount = paymentResult.nextCount
      nextGroupStatus = paymentResult.nextStatus
    }
  }

  if (order.status !== 'success') {
    const paidAt = order.pay_time || now.toISOString()
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'success',
        pay_time: paidAt,
        updated_at: paidAt
      })
      .eq('id', order.id)
      .eq('user_id', userId)

    if (orderUpdateError) {
      throw orderUpdateError
    }
  }

  return {
    order,
    groupId: targetGroupId,
    currentCount,
    targetCount,
    groupStatus: nextGroupStatus
  }
}

const rollbackGroupParticipationForOrder = async ({
  supabase,
  order,
  now = new Date()
}) => {
  const rollbackDetail = {
    membership_removed: false,
    previous_group_status: '',
    next_group_status: '',
    previous_group_count: 0,
    next_group_count: 0
  }

  if (!order || !order.group_id) {
    return rollbackDetail
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, status, current_count, target_count, expire_time')
    .eq('id', order.group_id)
    .maybeSingle()

  if (groupError) {
    throw groupError
  }

  if (!group) {
    return rollbackDetail
  }

  rollbackDetail.previous_group_status = group.status || ''
  rollbackDetail.previous_group_count = Number(group.current_count || 0)

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id, user_id')
    .eq('group_id', order.group_id)
    .eq('user_id', order.user_id)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  const refundResult = applyRefundToGroup({
    group,
    membershipExists: !!membership,
    now
  })

  if (refundResult.membershipShouldDelete) {
    const { error: deleteMembershipError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', order.group_id)
      .eq('user_id', order.user_id)

    if (deleteMembershipError) {
      throw deleteMembershipError
    }

    rollbackDetail.membership_removed = true
  }

  const { error: updateGroupError } = await supabase
    .from('groups')
    .update({
      current_count: refundResult.nextCount,
      status: refundResult.nextStatus
    })
    .eq('id', order.group_id)

  if (updateGroupError) {
    throw updateGroupError
  }

  rollbackDetail.next_group_count = refundResult.nextCount
  rollbackDetail.next_group_status = refundResult.nextStatus

  return rollbackDetail
}

module.exports = {
  createPendingOrder,
  createServiceError,
  hasUserJoinedCourseGroup,
  isServiceError,
  markOrderPaymentSuccess,
  rollbackGroupParticipationForOrder
}
