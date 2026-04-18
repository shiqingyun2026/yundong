const { execute, query } = require('../config/db')
const { createUuid, parseJsonField, stringifyJsonField, toDbDateTime } = require('./_helpers')

const PAYMENT_RECORD_SELECT_FIELDS = `
  id,
  order_id,
  user_id,
  course_id,
  group_id,
  provider,
  channel,
  payment_mode,
  out_trade_no,
  transaction_id,
  amount,
  status,
  callback_status,
  prepare_payload,
  callback_payload,
  paid_at,
  closed_at,
  created_at,
  updated_at
`

const normalizePaymentRecord = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    order_id: row.order_id,
    user_id: row.user_id,
    course_id: row.course_id,
    group_id: row.group_id || '',
    provider: row.provider || 'wechat',
    channel: row.channel || 'mini_program',
    payment_mode: row.payment_mode || 'mock',
    out_trade_no: row.out_trade_no || '',
    transaction_id: row.transaction_id || '',
    amount: Number(row.amount) || 0,
    status: row.status || 'pending',
    callback_status: row.callback_status || '',
    prepare_payload: parseJsonField(row.prepare_payload),
    callback_payload: parseJsonField(row.callback_payload),
    paid_at: row.paid_at || null,
    closed_at: row.closed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const createPaymentRecord = async ({
  id = createUuid(),
  order_id,
  user_id,
  course_id,
  group_id,
  provider = 'wechat',
  channel = 'mini_program',
  payment_mode = 'mock',
  out_trade_no,
  transaction_id = '',
  amount = 0,
  status = 'pending',
  callback_status = '',
  prepare_payload = null,
  callback_payload = null,
  paid_at = null,
  closed_at = null,
  created_at = new Date(),
  updated_at = created_at
}) => {
  await execute(
    `
      insert into payment_records (
        id, order_id, user_id, course_id, group_id, provider, channel, payment_mode, out_trade_no,
        transaction_id, amount, status, callback_status, prepare_payload, callback_payload,
        paid_at, closed_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      order_id,
      user_id,
      course_id,
      group_id || null,
      provider,
      channel,
      payment_mode,
      out_trade_no,
      transaction_id || '',
      Number(amount) || 0,
      status,
      callback_status || '',
      stringifyJsonField(prepare_payload),
      stringifyJsonField(callback_payload),
      paid_at ? toDbDateTime(paid_at) : null,
      closed_at ? toDbDateTime(closed_at) : null,
      toDbDateTime(created_at),
      toDbDateTime(updated_at)
    ]
  )

  return findPaymentRecordById(id)
}

const findPaymentRecordById = async id => {
  const rows = await query(
    `
      select ${PAYMENT_RECORD_SELECT_FIELDS}
      from payment_records
      where id = ?
      limit 1
    `,
    [id]
  )

  return normalizePaymentRecord(rows[0])
}

const findPaymentRecordByOrderId = async orderId => {
  const rows = await query(
    `
      select ${PAYMENT_RECORD_SELECT_FIELDS}
      from payment_records
      where order_id = ?
      limit 1
    `,
    [orderId]
  )

  return normalizePaymentRecord(rows[0])
}

const findPaymentRecordByOutTradeNo = async outTradeNo => {
  const rows = await query(
    `
      select ${PAYMENT_RECORD_SELECT_FIELDS}
      from payment_records
      where out_trade_no = ?
      limit 1
    `,
    [outTradeNo]
  )

  return normalizePaymentRecord(rows[0])
}

const updatePaymentRecord = async (id, payload = {}) => {
  const updates = []
  const params = []

  const assign = (field, value, transform = current => current) => {
    if (value === undefined) {
      return
    }

    updates.push(`${field} = ?`)
    params.push(transform(value))
  }

  assign('order_id', payload.order_id)
  assign('user_id', payload.user_id)
  assign('course_id', payload.course_id)
  assign('group_id', payload.group_id)
  assign('provider', payload.provider)
  assign('channel', payload.channel)
  assign('payment_mode', payload.payment_mode)
  assign('out_trade_no', payload.out_trade_no)
  assign('transaction_id', payload.transaction_id)
  assign('amount', payload.amount, value => Number(value) || 0)
  assign('status', payload.status)
  assign('callback_status', payload.callback_status)
  assign('prepare_payload', payload.prepare_payload, stringifyJsonField)
  assign('callback_payload', payload.callback_payload, stringifyJsonField)
  assign('paid_at', payload.paid_at, value => (value ? toDbDateTime(value) : null))
  assign('closed_at', payload.closed_at, value => (value ? toDbDateTime(value) : null))
  assign('updated_at', payload.updated_at, value => (value ? toDbDateTime(value) : toDbDateTime(new Date())))

  if (!updates.some(item => item.startsWith('updated_at'))) {
    updates.push('updated_at = ?')
    params.push(toDbDateTime(new Date()))
  }

  if (!updates.length) {
    return findPaymentRecordById(id)
  }

  params.push(id)
  await execute(`update payment_records set ${updates.join(', ')} where id = ?`, params)
  return findPaymentRecordById(id)
}

module.exports = {
  createPaymentRecord,
  findPaymentRecordByOrderId,
  findPaymentRecordByOutTradeNo,
  updatePaymentRecord
}
