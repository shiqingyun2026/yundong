const { markOrderPaymentSuccess } = require('./groupOrders')

const PAYMENT_MODE_MOCK = 'mock'
const PAYMENT_MODE_WECHAT = 'wechat'

const createServiceError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const resolvePaymentMode = () => {
  const mode = `${process.env.PAYMENT_PROVIDER_MODE || PAYMENT_MODE_MOCK}`.trim().toLowerCase()
  return mode === PAYMENT_MODE_WECHAT ? PAYMENT_MODE_WECHAT : PAYMENT_MODE_MOCK
}

const buildOutTradeNo = order => {
  const base = (order && (order.order_no || order.id) ? `${order.order_no || order.id}` : '').replace(/[^a-zA-Z0-9_-]/g, '')
  return base || `order_${Date.now()}`
}

const getOrderForUser = async ({ supabase, userId, orderId }) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getOrderById = async ({ supabase, orderId }) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, course_id, group_id, amount, status, created_at, pay_time, refund_time, refund_reason')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getPaymentRecordByOrderId = async ({ supabase, orderId }) => {
  const { data, error } = await supabase
    .from('payment_records')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const upsertPaymentRecord = async ({ supabase, order, paymentMode, payload, now = new Date() }) => {
  const timestamp = now.toISOString()
  const outTradeNo = buildOutTradeNo(order)
  const nextPayload = {
    order_id: order.id,
    user_id: order.user_id,
    course_id: order.course_id,
    group_id: order.group_id,
    provider: 'wechat',
    channel: 'mini_program',
    payment_mode: paymentMode,
    out_trade_no: outTradeNo,
    amount: Number(order.amount) || 0,
    status: order.status === 'success' ? 'paid' : 'pending',
    prepare_payload: payload || null,
    updated_at: timestamp
  }

  const existingRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })

  if (existingRecord) {
    const { data, error } = await supabase
      .from('payment_records')
      .update(nextPayload)
      .eq('id', existingRecord.id)
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return data
  }

  const { data, error } = await supabase
    .from('payment_records')
    .insert({
      ...nextPayload,
      created_at: timestamp
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

const buildWechatShellParams = ({ paymentRecord }) => ({
  timeStamp: '',
  nonceStr: '',
  package: '',
  signType: 'RSA',
  paySign: '',
  outTradeNo: paymentRecord.out_trade_no || ''
})

const prepareOrderPayment = async ({ supabase, userId, orderId, now = new Date() }) => {
  const order = await getOrderForUser({
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

  const paymentMode = resolvePaymentMode()
  const paymentRecord = await upsertPaymentRecord({
    supabase,
    order,
    paymentMode,
    payload: {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id
    },
    now
  })

  const canUseRequestPayment = paymentMode === PAYMENT_MODE_WECHAT

  return {
    orderId: order.id,
    courseId: order.course_id,
    groupId: order.group_id,
    amount: Number(order.amount) || 0,
    orderStatus: order.status,
    paymentMode,
    canUseRequestPayment,
    outTradeNo: paymentRecord.out_trade_no || '',
    paymentRecordStatus: paymentRecord.status || 'pending',
    paymentParams: canUseRequestPayment ? buildWechatShellParams({ paymentRecord }) : {}
  }
}

const getOrderPaymentStatus = async ({ supabase, userId, orderId }) => {
  const order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })

  return {
    orderId: order.id,
    orderNo: order.order_no || order.id,
    courseId: order.course_id,
    groupId: order.group_id,
    amount: Number(order.amount) || 0,
    orderStatus: order.status || 'pending',
    payTime: order.pay_time || '',
    refundTime: order.refund_time || '',
    refundReason: order.refund_reason || '',
    paymentMode: (paymentRecord && paymentRecord.payment_mode) || resolvePaymentMode(),
    outTradeNo: (paymentRecord && paymentRecord.out_trade_no) || '',
    paymentRecordStatus: (paymentRecord && paymentRecord.status) || 'not_prepared'
  }
}

const handleWechatPaymentCallback = async ({ supabase, payload, now = new Date() }) => {
  const resource = payload && payload.resource ? payload.resource : {}
  const outerBody = payload && typeof payload === 'object' ? payload : {}
  const orderId =
    outerBody.orderId ||
    outerBody.order_id ||
    outerBody.attachOrderId ||
    resource.orderId ||
    resource.order_id ||
    ''
  const outTradeNo =
    outerBody.out_trade_no ||
    outerBody.outTradeNo ||
    resource.out_trade_no ||
    resource.outTradeNo ||
    ''
  const transactionId =
    outerBody.transaction_id ||
    outerBody.transactionId ||
    resource.transaction_id ||
    resource.transactionId ||
    ''
  const callbackStatus =
    `${outerBody.trade_state || outerBody.tradeState || outerBody.status || resource.trade_state || resource.tradeState || ''}`
      .trim()
      .toUpperCase()
  const timestamp = now.toISOString()

  let paymentRecord = null

  if (orderId) {
    paymentRecord = await getPaymentRecordByOrderId({
      supabase,
      orderId
    })
  }

  if (!paymentRecord && outTradeNo) {
    const { data, error } = await supabase
      .from('payment_records')
      .select('*')
      .eq('out_trade_no', outTradeNo)
      .maybeSingle()

    if (error) {
      throw error
    }

    paymentRecord = data
  }

  if (!paymentRecord) {
    throw createServiceError(404, 'payment record not found')
  }

  const nextStatus =
    callbackStatus === 'SUCCESS' || callbackStatus === 'PAID'
      ? 'paid'
      : callbackStatus === 'CLOSED' || callbackStatus === 'REVOKED'
        ? 'closed'
        : 'processing'

  const { data: updatedRecord, error: updateError } = await supabase
    .from('payment_records')
    .update({
      status: nextStatus,
      transaction_id: transactionId || paymentRecord.transaction_id || '',
      callback_status: callbackStatus || nextStatus,
      callback_payload: payload || null,
      paid_at: nextStatus === 'paid' ? timestamp : paymentRecord.paid_at,
      closed_at: nextStatus === 'closed' ? timestamp : paymentRecord.closed_at,
      updated_at: timestamp
    })
    .eq('id', paymentRecord.id)
    .select('*')
    .single()

  if (updateError) {
    throw updateError
  }

  let orderStatus = ''

  if (nextStatus === 'paid') {
    const order = await getOrderById({
      supabase,
      orderId: updatedRecord.order_id
    })

    if (!order) {
      throw createServiceError(404, 'order not found')
    }

    if (order.status !== 'success') {
      await markOrderPaymentSuccess({
        supabase,
        userId: order.user_id,
        orderId: order.id,
        groupId: order.group_id,
        now
      })
    }

    orderStatus = 'success'
  } else if (nextStatus === 'closed') {
    const { error: orderCloseError } = await supabase
      .from('orders')
      .update({
        status: 'closed',
        updated_at: timestamp
      })
      .eq('id', updatedRecord.order_id)
      .eq('status', 'pending')

    if (orderCloseError) {
      throw orderCloseError
    }

    orderStatus = 'closed'
  } else {
    orderStatus = 'pending'
  }

  return {
    orderId: updatedRecord.order_id,
    outTradeNo: updatedRecord.out_trade_no,
    paymentRecordStatus: updatedRecord.status,
    callbackStatus: updatedRecord.callback_status || '',
    orderStatus
  }
}

const markPaymentRecordPaid = async ({ supabase, orderId, transactionId = '', now = new Date() }) => {
  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId
  })

  if (!paymentRecord) {
    return null
  }

  const timestamp = now.toISOString()
  const { data, error } = await supabase
    .from('payment_records')
    .update({
      status: 'paid',
      callback_status: paymentRecord.callback_status || 'MOCK_SUCCESS',
      transaction_id: transactionId || paymentRecord.transaction_id || '',
      paid_at: paymentRecord.paid_at || timestamp,
      updated_at: timestamp
    })
    .eq('id', paymentRecord.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

module.exports = {
  PAYMENT_MODE_MOCK,
  PAYMENT_MODE_WECHAT,
  createServiceError,
  prepareOrderPayment,
  getOrderPaymentStatus,
  handleWechatPaymentCallback,
  markPaymentRecordPaid
}
