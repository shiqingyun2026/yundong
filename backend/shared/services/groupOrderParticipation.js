const { env } = require('../../config/env')
const { groupMembersRepository, groupsRepository, ordersRepository } = require('../../repositories')
const { applyRefundToGroup, hasSuccessfulParticipation } = require('../domain/groupRules')

const hasUserJoinedCourseGroup = async ({ supabase, userId, courseId }) => {
  if (env.useMySqlRepositories) {
    const successGroups = await groupsRepository.listGroups({
      courseIds: [courseId],
      statuses: ['success']
    })

    const groupIds = successGroups.map(item => item.id).filter(Boolean)
    let successMembershipExists = false

    if (groupIds.length) {
      const memberships = await groupMembersRepository.listGroupMembers({
        userId,
        groupIds
      })
      successMembershipExists = memberships.length > 0
    }

    const orders = await ordersRepository.listOrders({
      userId,
      courseId,
      status: 'success'
    })

    return hasSuccessfulParticipation({
      successMembershipExists,
      successOrderExists: orders.length > 0
    })
  }

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

  if (env.useMySqlRepositories) {
    const group = await groupsRepository.findGroupById(order.group_id)

    if (!group) {
      return rollbackDetail
    }

    rollbackDetail.previous_group_status = group.status || ''
    rollbackDetail.previous_group_count = Number(group.current_count || 0)

    const membership = await groupMembersRepository.findMembership({
      groupId: order.group_id,
      userId: order.user_id
    })

    const refundResult = applyRefundToGroup({
      group,
      membershipExists: !!membership,
      now
    })

    if (refundResult.membershipShouldDelete) {
      await groupMembersRepository.removeMember({
        groupId: order.group_id,
        userId: order.user_id
      })

      rollbackDetail.membership_removed = true
    }

    await groupsRepository.updateGroup(order.group_id, {
      current_count: refundResult.nextCount,
      status: refundResult.nextStatus
    })

    rollbackDetail.next_group_count = refundResult.nextCount
    rollbackDetail.next_group_status = refundResult.nextStatus

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
  hasUserJoinedCourseGroup,
  rollbackGroupParticipationForOrder
}
