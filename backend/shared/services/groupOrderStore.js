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

module.exports = {
  cleanupExpiredActiveGroupsForCourse,
  closePendingOrdersByIds,
  getOrderForUser,
  listPendingOrderIdsForCourse
}
