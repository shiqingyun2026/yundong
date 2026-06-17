const { execute, query } = require('../config/db')
const { buildInClause, createUuid, parseJsonField, stringifyJsonField, toDbDateTime } = require('./_helpers')
const { buildPackageOrderNo } = require('./bizSerialCountersRepository')

const ORDER_SELECT_FIELDS = `
  id,
  order_no,
  user_id,
  order_type,
  course_id,
  group_id,
  package_id,
  package_group_id,
  package_action,
  package_context,
  amount,
  status,
  created_at,
  updated_at,
  pay_time,
  refund_time,
  refund_reason,
  refund_operator_id,
  transaction_id
`

const normalizeOrder = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    order_no: row.order_no || '',
    user_id: row.user_id,
    order_type: Number(row.order_type) || 1,
    course_id: row.course_id || '',
    group_id: row.group_id || '',
    package_id: row.package_id || '',
    package_group_id: row.package_group_id || '',
    package_action: row.package_action || '',
    package_context: parseJsonField(row.package_context),
    amount: Number(row.amount) || 0,
    status: row.status || 'pending',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    pay_time: row.pay_time || null,
    refund_time: row.refund_time || null,
    refund_reason: row.refund_reason || '',
    refund_operator_id: row.refund_operator_id || null,
    transaction_id: row.transaction_id || ''
  }
}

const createOrder = async ({
  id = createUuid(),
  order_no,
  user_id,
  order_type = 1,
  course_id,
  group_id,
  package_id,
  package_group_id,
  package_action = null,
  package_context = null,
  amount = 0,
  status = 'pending',
  created_at = new Date(),
  updated_at = created_at,
  pay_time = null,
  refund_time = null,
  refund_reason = '',
  refund_operator_id = null,
  transaction_id = ''
}) => {
  const createdAt = toDbDateTime(created_at) || toDbDateTime(new Date())
  const updatedAt = toDbDateTime(updated_at) || createdAt
  const resolvedId = id || createUuid()
  const resolvedOrderNo = order_no || (await buildPackageOrderNo(created_at || new Date()))

  await execute(
    `
      insert into orders (
        id, order_no, user_id, order_type, course_id, group_id, package_id, package_group_id, package_action, package_context, amount, status,
        created_at, updated_at, pay_time, refund_time, refund_reason, refund_operator_id, transaction_id
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      resolvedId,
      resolvedOrderNo,
      user_id,
      Number(order_type) || 1,
      course_id || null,
      group_id || null,
      package_id || null,
      package_group_id || null,
      package_action || null,
      stringifyJsonField(package_context),
      Number(amount) || 0,
      status,
      createdAt,
      updatedAt,
      pay_time ? toDbDateTime(pay_time) : null,
      refund_time ? toDbDateTime(refund_time) : null,
      refund_reason || '',
      refund_operator_id || null,
      transaction_id || ''
    ]
  )

  return findOrderById(resolvedId)
}

const findOrderById = async id => {
  const rows = await query(
    `
      select ${ORDER_SELECT_FIELDS}
      from orders
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizeOrder(rows[0])
}

const findOrderByOrderNo = async orderNo => {
  const rows = await query(
    `
      select ${ORDER_SELECT_FIELDS}
      from orders
      where order_no = ?
      limit 1
    `,
    [orderNo]
  )

  return normalizeOrder(rows[0])
}

const findOrderForUser = async ({ userId, orderId }) => {
  const rows = await query(
    `
      select ${ORDER_SELECT_FIELDS}
      from orders
      where id = ?
        and user_id = ?
      limit 1
    `,
    [orderId, userId]
  )

  return normalizeOrder(rows[0])
}

const listOrders = async ({ userId, orderType, courseId, groupId, packageId, packageGroupId, packageAction, status, statuses = [] } = {}) => {
  const conditions = []
  const params = []

  if (userId) {
    conditions.push('user_id = ?')
    params.push(userId)
  }

  if (orderType !== undefined && orderType !== null && orderType !== '') {
    conditions.push('order_type = ?')
    params.push(Number(orderType))
  }

  if (courseId) {
    conditions.push('course_id = ?')
    params.push(courseId)
  }

  if (groupId) {
    conditions.push('group_id = ?')
    params.push(groupId)
  }

  if (packageId) {
    conditions.push('package_id = ?')
    params.push(packageId)
  }

  if (packageGroupId) {
    conditions.push('package_group_id = ?')
    params.push(packageGroupId)
  }

  if (packageAction) {
    conditions.push('package_action = ?')
    params.push(packageAction)
  }

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const statusFilter = buildInClause(statuses)
  if (statusFilter.items.length) {
    conditions.push(`status in (${statusFilter.placeholders})`)
    params.push(...statusFilter.items)
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : ''
  const rows = await query(
    `
      select ${ORDER_SELECT_FIELDS}
      from orders
      ${where}
      order by created_at desc
    `,
    params
  )

  return rows.map(normalizeOrder)
}

const listOrdersByGroupId = async ({ groupId, status, statuses = [] } = {}) => {
  return listOrders({
    orderType: 1,
    groupId,
    status,
    statuses
  })
}

const listOrdersByPackageGroupId = async ({ packageGroupId, status, statuses = [] } = {}) => {
  return listOrders({
    orderType: 2,
    packageGroupId,
    status,
    statuses
  })
}

const listPendingOrderIdsByUserAndCourse = async ({ userId, courseId }) => {
  const rows = await query(
    `
      select id
      from orders
      where user_id = ?
        and order_type = 1
        and course_id = ?
        and status = 'pending'
    `,
    [userId, courseId]
  )

  return rows.map(item => item.id).filter(Boolean)
}

const listPendingOrderIdsByUserAndPackage = async ({ userId, packageId }) => {
  const rows = await query(
    `
      select id
      from orders
      where user_id = ?
        and order_type = 2
        and package_id = ?
        and status = 'pending'
    `,
    [userId, packageId]
  )

  return rows.map(item => item.id).filter(Boolean)
}

const closeOrdersByIds = async ({ orderIds = [], now = new Date() }) => {
  const { items, placeholders } = buildInClause(orderIds)
  if (!items.length) {
    return []
  }

  await execute(
    `
      update orders
      set status = 'closed',
          updated_at = ?
      where id in (${placeholders})
        and status = 'pending'
    `,
    [toDbDateTime(now), ...items]
  )

  const rows = await query(
    `
      select ${ORDER_SELECT_FIELDS}
      from orders
      where id in (${placeholders})
        and status = 'closed'
    `,
    items
  )

  return rows.map(normalizeOrder)
}

const updateOrder = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }

    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('order_no', payload.order_no)
  assign('user_id', payload.user_id)
  assign('order_type', payload.order_type, value => Number(value) || 1)
  assign('course_id', payload.course_id)
  assign('group_id', payload.group_id)
  assign('package_id', payload.package_id)
  assign('package_group_id', payload.package_group_id)
  assign('package_action', payload.package_action)
  assign('package_context', payload.package_context, stringifyJsonField)
  assign('amount', payload.amount, value => Number(value) || 0)
  assign('status', payload.status)
  assign('pay_time', payload.pay_time, value => (value ? toDbDateTime(value) : null))
  assign('refund_time', payload.refund_time, value => (value ? toDbDateTime(value) : null))
  assign('refund_reason', payload.refund_reason)
  assign('refund_operator_id', payload.refund_operator_id)
  assign('transaction_id', payload.transaction_id)

  if (payload.updated_at !== undefined) {
    assign('updated_at', payload.updated_at, value => (value ? toDbDateTime(value) : toDbDateTime(new Date())))
  } else {
    updates.push('updated_at = ?')
    params.push(toDbDateTime(new Date()))
  }

  if (!updates.length) {
    return findOrderById(id)
  }

  params.push(id)
  await execute(`update orders set ${updates.join(', ')} where id = ?`, params)
  return findOrderById(id)
}

module.exports = {
  closeOrdersByIds,
  createOrder,
  findOrderById,
  findOrderByOrderNo,
  findOrderForUser,
  listOrders,
  listOrdersByGroupId,
  listOrdersByPackageGroupId,
  listPendingOrderIdsByUserAndCourse,
  listPendingOrderIdsByUserAndPackage,
  updateOrder
}
