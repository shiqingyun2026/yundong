const { env } = require('../../config/env')
const { ordersRepository, paymentRecordsRepository, usersRepository } = require('../../repositories')
const { markOrderPaymentSuccess } = require('./groupOrders')
const { markPaymentRecordRefunded: markMySqlPaymentRecordRefunded } = require('./paymentRecordStatus')
const { finalizePackageOrderRefund } = require('./packageRefundService')
const {
  createMiniProgramPayment,
  buildMiniProgramPaymentParams,
  decryptWechatPayResource,
  queryWechatPaymentByOutTradeNo
} = require('./wechatMiniProgram')

const PAYMENT_MODE_MOCK = 'mock'
const PAYMENT_MODE_WECHAT = 'wechat'
const PAYMENT_MODE_CLOUDPAY = 'cloudpay'

const createServiceError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const markPackageOrderPaymentSuccess = async payload => {
  const packageOrders = require('./packageOrders')
  return packageOrders.markPackageOrderPaymentSuccess(payload)
}

const resolvePaymentMode = () => {
  const mode = `${env.paymentProviderMode || process.env.PAYMENT_PROVIDER_MODE || PAYMENT_MODE_MOCK}`.trim().toLowerCase()
  if (mode === PAYMENT_MODE_WECHAT) {
    return PAYMENT_MODE_WECHAT
  }
  if (mode === PAYMENT_MODE_CLOUDPAY) {
    return PAYMENT_MODE_CLOUDPAY
  }
  return PAYMENT_MODE_MOCK
}

const isWechatPaymentMode = () => resolvePaymentMode() === PAYMENT_MODE_WECHAT

const isCloudPayPaymentMode = () => resolvePaymentMode() === PAYMENT_MODE_CLOUDPAY

const buildOutTradeNo = order => {
  const base = (order && (order.order_no || order.id) ? `${order.order_no || order.id}` : '').replace(/[^a-zA-Z0-9_-]/g, '')
  return base || `order_${Date.now()}`
}

const buildOutRefundNo = order => `RF-${buildOutTradeNo(order)}`.slice(0, 64)

const getOrderForUser = async ({ supabase, userId, orderId }) => {
  if (env.useMySqlRepositories) {
    return ordersRepository.findOrderForUser({
      userId,
      orderId
    })
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, order_type, course_id, group_id, package_id, package_group_id, package_action, amount, status, created_at, pay_time, refund_time, refund_reason')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getOrderById = async ({ supabase, orderId }) => {
  if (env.useMySqlRepositories) {
    return ordersRepository.findOrderById(orderId)
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, user_id, order_type, course_id, group_id, package_id, package_group_id, package_action, amount, status, created_at, pay_time, refund_time, refund_reason')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getUserById = async ({ supabase, userId }) => {
  if (env.useMySqlRepositories) {
    return usersRepository.findUserById(userId)
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, openid, nickname')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getUserByOpenId = async ({ supabase, openId }) => {
  const normalizedOpenId = `${openId || ''}`.trim()
  if (!normalizedOpenId) {
    return null
  }

  if (env.useMySqlRepositories) {
    return usersRepository.findUserByOpenId(normalizedOpenId)
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, openid, nickname')
    .eq('openid', normalizedOpenId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

const getPaymentRecordByOrderId = async ({ supabase, orderId }) => {
  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  }

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

const getPaymentRecordByOutTradeNo = async ({ supabase, outTradeNo }) => {
  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.findPaymentRecordByOutTradeNo(outTradeNo)
  }

  const { data, error } = await supabase
    .from('payment_records')
    .select('*')
    .eq('out_trade_no', outTradeNo)
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
    package_id: order.package_id,
    package_group_id: order.package_group_id,
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
    if (env.useMySqlRepositories) {
      return paymentRecordsRepository.updatePaymentRecord(existingRecord.id, nextPayload)
    }

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

  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.createPaymentRecord({
      ...nextPayload,
      created_at: timestamp
    })
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

const updatePaymentRecordPreparePayload = async ({ supabase, paymentRecordId, preparePayload, now = new Date() }) => {
  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.updatePaymentRecord(paymentRecordId, {
      prepare_payload: preparePayload || null,
      updated_at: now
    })
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update({
      prepare_payload: preparePayload || null,
      updated_at: now.toISOString()
    })
    .eq('id', paymentRecordId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

const ensureOrderPayable = order => {
  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  if (order.status === 'refunded') {
    throw createServiceError(400, 'order is refunded')
  }

  if (order.status === 'closed') {
    throw createServiceError(400, 'order is closed')
  }
}

const closeOrderPayment = async ({ supabase, userId, orderId, now = new Date() }) => {
  const order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  if (order.status === 'success') {
    throw createServiceError(400, 'order is already paid')
  }

  if (order.status === 'refunded') {
    throw createServiceError(400, 'order is refunded')
  }

  const timestamp = now.toISOString()
  let closedOrder = order

  if (order.status === 'pending') {
    if (env.useMySqlRepositories) {
      const closedOrders = await ordersRepository.closeOrdersByIds({
        orderIds: [order.id],
        now
      })
      closedOrder = (closedOrders || []).find(item => item.id === order.id) || await ordersRepository.findOrderById(order.id)
    } else {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'closed',
          updated_at: timestamp
        })
        .eq('id', order.id)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()

      if (error) {
        throw error
      }

      closedOrder = data || await getOrderForUser({
        supabase,
        userId,
        orderId: order.id
      })
    }
  }

  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })

  if (paymentRecord && paymentRecord.status !== 'paid' && paymentRecord.status !== 'refunded') {
    if (env.useMySqlRepositories) {
      await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: 'closed',
        callback_status: paymentRecord.callback_status || 'USER_CANCEL',
        closed_at: paymentRecord.closed_at || timestamp,
        updated_at: timestamp
      })
    } else {
      const { error } = await supabase
        .from('payment_records')
        .update({
          status: 'closed',
          callback_status: paymentRecord.callback_status || 'USER_CANCEL',
          closed_at: paymentRecord.closed_at || timestamp,
          updated_at: timestamp
        })
        .eq('id', paymentRecord.id)

      if (error) {
        throw error
      }
    }
  }

  return {
    orderId: order.id,
    orderStatus: (closedOrder && closedOrder.status) || 'closed',
    paymentRecordStatus: paymentRecord ? 'closed' : 'not_prepared'
  }
}

const buildPaymentDescription = ({ order, user }) => {
  const parts = ['邻动体适能课程报名']

  if (user && user.nickname) {
    parts.push(user.nickname)
  }

  if (order && order.order_no) {
    parts.push(order.order_no)
  }

  return parts.join('-').slice(0, 127)
}

const prepareWechatPayment = async ({ supabase, order, now = new Date() }) => {
  const user = await getUserById({
    supabase,
    userId: order.user_id
  })

  if (!user || !user.openid) {
    throw createServiceError(400, 'user openid is required for wechat payment')
  }

  const paymentRecord = await upsertPaymentRecord({
    supabase,
    order,
    paymentMode: PAYMENT_MODE_WECHAT,
    payload: {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      packageId: order.package_id,
      packageGroupId: order.package_group_id
    },
    now
  })

  const attach = JSON.stringify({
    orderId: order.id,
    groupId: order.group_id || '',
    courseId: order.course_id
  })
  const createResult = await createMiniProgramPayment({
    openId: user.openid,
    description: buildPaymentDescription({ order, user }),
    outTradeNo: paymentRecord.out_trade_no,
    amountFen: Number(order.amount) || 0,
    attach
  })

  if (!createResult || !createResult.prepay_id) {
    throw new Error('wechat pay prepay_id missing')
  }

  const paymentParams = buildMiniProgramPaymentParams(createResult.prepay_id)

  await updatePaymentRecordPreparePayload({
    supabase,
    paymentRecordId: paymentRecord.id,
    preparePayload: {
      ...(paymentRecord.prepare_payload || {}),
      openId: user.openid,
      prepayId: createResult.prepay_id,
      paymentParams
    },
    now
  })

  return {
    paymentRecord,
    paymentParams,
    prepayId: createResult.prepay_id
  }
}

const prepareCloudPayUnifiedOrder = async ({ supabase, userId, openId, orderId, now = new Date() }) => {
  const resolvedOpenId = `${openId || ''}`.trim()
  let user = userId
    ? await getUserById({
        supabase,
        userId
      })
    : null

  if (!user && resolvedOpenId) {
    user = await getUserByOpenId({
      supabase,
      openId: resolvedOpenId
    })
  }

  if (!user || !user.id) {
    throw createServiceError(400, 'user is required for cloudpay')
  }

  const order = await getOrderForUser({
    supabase,
    userId: user.id,
    orderId
  })

  ensureOrderPayable(order)

  const paymentOpenId = `${resolvedOpenId || user.openid || ''}`.trim()
  if (!paymentOpenId) {
    throw createServiceError(400, 'user openid is required for cloudpay')
  }

  if (user.openid && user.openid !== paymentOpenId) {
    throw createServiceError(403, 'openid does not match order user')
  }

  const paymentRecord = await upsertPaymentRecord({
    supabase,
    order,
    paymentMode: PAYMENT_MODE_CLOUDPAY,
    payload: {
      orderId: order.id,
      courseId: order.course_id,
      groupId: order.group_id,
      packageId: order.package_id,
      packageGroupId: order.package_group_id
    },
    now
  })

  const attach = JSON.stringify({
    v: 1,
    orderNo: paymentRecord.out_trade_no
  })

  return {
    orderId: order.id,
    openId: paymentOpenId,
    body: buildPaymentDescription({ order, user }),
    outTradeNo: paymentRecord.out_trade_no,
    totalFee: Number(order.amount) || 0,
    attach,
    paymentRecordId: paymentRecord.id
  }
}

const prepareOrderPayment = async ({ supabase, userId, orderId, now = new Date() }) => {
  const order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  ensureOrderPayable(order)

  const paymentMode = resolvePaymentMode()
  let paymentRecord = null
  let paymentParams = {}

  if (paymentMode === PAYMENT_MODE_WECHAT) {
    const result = await prepareWechatPayment({
      supabase,
      order,
      now
    })
    paymentRecord = result.paymentRecord
    paymentParams = result.paymentParams
  } else {
    paymentRecord = await upsertPaymentRecord({
      supabase,
      order,
      paymentMode,
      payload: {
        orderId: order.id,
        courseId: order.course_id,
        groupId: order.group_id,
        packageId: order.package_id,
        packageGroupId: order.package_group_id
      },
      now
    })
  }

  const canUseRequestPayment = paymentMode === PAYMENT_MODE_WECHAT

  return {
    orderId: order.id,
    courseId: order.course_id,
    groupId: order.group_id,
    packageId: order.package_id,
    packageGroupId: order.package_group_id,
    amount: Number(order.amount) || 0,
    orderStatus: order.status,
    paymentMode,
    canUseRequestPayment,
    outTradeNo: paymentRecord.out_trade_no || '',
    paymentRecordStatus: paymentRecord.status || 'pending',
    paymentParams
  }
}

const getOrderPaymentStatus = async ({ supabase, userId, orderId }) => {
  let order = await getOrderForUser({
    supabase,
    userId,
    orderId
  })

  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  let paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })

  const shouldQueryWechatPayment =
    paymentRecord &&
    paymentRecord.payment_mode === PAYMENT_MODE_WECHAT &&
    ['pending', 'processing'].includes(paymentRecord.status || '') &&
    (order.status || '') === 'pending' &&
    !!`${paymentRecord.out_trade_no || ''}`.trim()

  if (shouldQueryWechatPayment) {
    try {
      const queryResult = await queryWechatPaymentByOutTradeNo({
        outTradeNo: paymentRecord.out_trade_no
      })
      const queryTradeState = `${queryResult && (queryResult.trade_state || queryResult.tradeState || queryResult.status || '')}`
        .trim()
        .toUpperCase()

      if (['SUCCESS', 'PAID', 'CLOSED', 'REVOKED'].includes(queryTradeState)) {
        await handleWechatPaymentCallback({
          supabase,
          payload: queryResult
        })

        order = await getOrderForUser({
          supabase,
          userId,
          orderId: order.id
        })
        paymentRecord = await getPaymentRecordByOrderId({
          supabase,
          orderId: order.id
        })
      }
    } catch (error) {
      console.warn('[paymentShell/getOrderPaymentStatus] wechat query reconcile skipped', {
        orderId: order.id,
        outTradeNo: paymentRecord.out_trade_no,
        message: error && error.message ? error.message : 'unknown error'
      })
    }
  }

  return {
    orderId: order.id,
    orderNo: order.order_no || order.id,
    courseId: order.course_id,
    groupId: order.group_id,
    packageId: order.package_id || '',
    packageGroupId: order.package_group_id || '',
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

const resolveCallbackPayload = payload => {
  if (payload && payload.resource && payload.resource.ciphertext) {
    const decryptedResource = decryptWechatPayResource(payload.resource)

    return {
      rawPayload: payload,
      resource: decryptedResource
    }
  }

  return {
    rawPayload: payload || {},
    resource: payload && payload.resource ? payload.resource : payload || {}
  }
}

const handleWechatPaymentCallback = async ({ supabase, payload, now = new Date() }) => {
  const { rawPayload, resource } = resolveCallbackPayload(payload)
  const outerBody = rawPayload && typeof rawPayload === 'object' ? rawPayload : {}
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
    `${outerBody.trade_state || outerBody.tradeState || outerBody.status || resource.trade_state || resource.tradeState || resource.trade_state_desc || ''}`
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
    paymentRecord = await getPaymentRecordByOutTradeNo({
      supabase,
      outTradeNo
    })
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

  if (nextStatus === 'paid' && ['refund_pending', 'refund_failed', 'refunded'].includes(paymentRecord.status)) {
    const order = await getOrderById({
      supabase,
      orderId: paymentRecord.order_id
    })

    return {
      orderId: paymentRecord.order_id,
      outTradeNo: paymentRecord.out_trade_no,
      paymentRecordStatus: paymentRecord.status,
      callbackStatus: paymentRecord.callback_status || '',
      orderStatus: order ? order.status : 'pending'
    }
  }

  const updatedRecord = env.useMySqlRepositories
    ? await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: nextStatus,
        transaction_id: transactionId || paymentRecord.transaction_id || '',
        callback_status: callbackStatus || nextStatus,
        callback_payload: rawPayload || null,
        paid_at: nextStatus === 'paid' ? timestamp : paymentRecord.paid_at,
        closed_at: nextStatus === 'closed' ? timestamp : paymentRecord.closed_at,
        updated_at: timestamp
      })
    : await (async () => {
        const { data, error } = await supabase
          .from('payment_records')
          .update({
            status: nextStatus,
            transaction_id: transactionId || paymentRecord.transaction_id || '',
            callback_status: callbackStatus || nextStatus,
            callback_payload: rawPayload || null,
            paid_at: nextStatus === 'paid' ? timestamp : paymentRecord.paid_at,
            closed_at: nextStatus === 'closed' ? timestamp : paymentRecord.closed_at,
            updated_at: timestamp
          })
          .eq('id', paymentRecord.id)
          .select('*')
          .single()

        if (error) {
          throw error
        }

        return data
      })()

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
      if (Number(order.order_type) === 2) {
        const packagePaymentResult = await markPackageOrderPaymentSuccess({
          userId: order.user_id,
          orderId: order.id,
          now
        })
        orderStatus = packagePaymentResult && packagePaymentResult.status ? packagePaymentResult.status : 'success'
      } else {
        await markOrderPaymentSuccess({
          supabase,
          userId: order.user_id,
          orderId: order.id,
          groupId: order.group_id,
          now
        })
        orderStatus = 'success'
      }
    } else {
      orderStatus = 'success'
    }
  } else if (nextStatus === 'closed') {
    if (env.useMySqlRepositories) {
      const order = await ordersRepository.findOrderById(updatedRecord.order_id)
      if (order && order.status === 'pending') {
        await ordersRepository.updateOrder(order.id, {
          status: 'closed',
          updated_at: timestamp
        })
      }
    } else {
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

const normalizeCloudPayCallbackPayload = payload => {
  const source = payload || {}
  return {
    outTradeNo: `${source.out_trade_no || source.outTradeNo || ''}`.trim(),
    transactionId: `${source.transaction_id || source.transactionId || ''}`.trim(),
    totalFee: Number(source.total_fee ?? source.totalFee ?? 0),
    returnCode: `${source.return_code || source.returnCode || ''}`.trim().toUpperCase(),
    resultCode: `${source.result_code || source.resultCode || ''}`.trim().toUpperCase(),
    openId: `${source.openid || source.openId || ''}`.trim(),
    attach: source.attach || ''
  }
}

const updatePaymentRecordForCloudPayCallback = async ({ supabase, paymentRecord, payload, transactionId, now }) => {
  const timestamp = now.toISOString()
  const patch = {
    status: 'paid',
    transaction_id: transactionId || paymentRecord.transaction_id || '',
    callback_status: 'SUCCESS',
    callback_payload: payload || null,
    paid_at: timestamp,
    updated_at: timestamp
  }

  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, patch)
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update(patch)
    .eq('id', paymentRecord.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

const handleCloudPayPaymentCallback = async ({ supabase, payload, now = new Date() }) => {
  const normalized = normalizeCloudPayCallbackPayload(payload)
  if (!normalized.outTradeNo) {
    throw createServiceError(400, 'out_trade_no is required')
  }

  const paymentRecord = await getPaymentRecordByOutTradeNo({
    supabase,
    outTradeNo: normalized.outTradeNo
  })
  if (!paymentRecord) {
    throw createServiceError(404, 'payment record not found')
  }

  const order = await getOrderById({
    supabase,
    orderId: paymentRecord.order_id
  })
  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  if (Number(order.amount) !== Number(normalized.totalFee)) {
    throw createServiceError(400, 'amount mismatch')
  }

  const tradeSuccess = normalized.returnCode === 'SUCCESS' && normalized.resultCode === 'SUCCESS'
  if (!tradeSuccess) {
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentRecordStatus: paymentRecord.status || 'pending'
    }
  }

  if (['refund_pending', 'refund_failed', 'refunded'].includes(paymentRecord.status)) {
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentRecordStatus: paymentRecord.status
    }
  }

  if (paymentRecord.status === 'paid' || order.status === 'success') {
    return {
      orderId: order.id,
      orderStatus: order.status === 'success' ? 'success' : order.status,
      paymentRecordStatus: 'paid'
    }
  }

  await updatePaymentRecordForCloudPayCallback({
    supabase,
    paymentRecord,
    payload,
    transactionId: normalized.transactionId,
    now
  })

  if (Number(order.order_type) === 2) {
    const packagePaymentResult = await markPackageOrderPaymentSuccess({
      userId: order.user_id,
      orderId: order.id,
      now
    })
    return {
      orderId: order.id,
      orderStatus: packagePaymentResult && packagePaymentResult.status ? packagePaymentResult.status : 'success',
      paymentRecordStatus: 'paid'
    }
  } else {
    await markOrderPaymentSuccess({
      supabase,
      userId: order.user_id,
      orderId: order.id,
      groupId: order.group_id,
      now
    })
  }

  return {
    orderId: order.id,
    orderStatus: 'success',
    paymentRecordStatus: 'paid'
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
  const order = await getOrderById({
    supabase,
    orderId
  })
  const relationPayload = order
    ? {
        course_id: order.course_id || null,
        group_id: order.group_id || null,
        ...(env.useMySqlRepositories
          ? {
              package_id: order.package_id || null,
              package_group_id: order.package_group_id || null
            }
          : {})
      }
    : {}

  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
      ...relationPayload,
      status: 'paid',
      callback_status: paymentRecord.callback_status || 'MOCK_SUCCESS',
      transaction_id: transactionId || paymentRecord.transaction_id || '',
      paid_at: paymentRecord.paid_at || timestamp,
      updated_at: timestamp
    })
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update({
      ...relationPayload,
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

const markPaymentRecordRefunded = async ({ supabase, orderId, reason = '', now = new Date() }) => {
  if (env.useMySqlRepositories) {
    return markMySqlPaymentRecordRefunded({
      orderId,
      reason,
      now
    })
  }

  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId
  })

  if (!paymentRecord) {
    return null
  }

  const timestamp = now.toISOString()
  const order = await getOrderById({
    supabase,
    orderId
  })
  const existingCallbackPayload =
    paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
      ? paymentRecord.callback_payload
      : {}
  const nextPayload = {
    ...(order
      ? {
          course_id: order.course_id || null,
          group_id: order.group_id || null,
          ...(env.useMySqlRepositories
            ? {
                package_id: order.package_id || null,
                package_group_id: order.package_group_id || null
              }
            : {})
        }
      : {}),
    status: 'refunded',
    callback_status: 'REFUNDED',
    callback_payload: {
      ...existingCallbackPayload,
      refund: {
        reason: `${reason || ''}`.trim(),
        refunded_at: timestamp
      }
    },
    closed_at: paymentRecord.closed_at || timestamp,
    updated_at: timestamp
  }

  if (env.useMySqlRepositories) {
    return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, nextPayload)
  }

  const { data, error } = await supabase
    .from('payment_records')
    .update(nextPayload)
    .eq('id', paymentRecord.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

const prepareCloudPayRefund = async ({ supabase, orderId, reason = '' }) => {
  const order = await getOrderById({
    supabase,
    orderId
  })
  if (!order) {
    throw createServiceError(404, 'order not found')
  }
  if (order.status !== 'success' && order.status !== 'refund_pending') {
    throw createServiceError(400, 'only paid order can be refunded')
  }

  const paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId: order.id
  })
  if (!paymentRecord || (paymentRecord.status !== 'paid' && paymentRecord.status !== 'refund_pending')) {
    throw createServiceError(400, 'paid payment record is required')
  }

  return {
    orderId: order.id,
    outTradeNo: paymentRecord.out_trade_no || buildOutTradeNo(order),
    outRefundNo: buildOutRefundNo(order),
    totalFee: Number(order.amount) || Number(paymentRecord.amount) || 0,
    refundFee: Number(order.amount) || Number(paymentRecord.amount) || 0,
    refundDesc: `${reason || '课程退款'}`.slice(0, 80)
  }
}

const markCloudPayRefundResult = async ({ supabase, payload, now = new Date() }) => {
  const orderId = payload && payload.orderId
  if (!orderId) {
    throw createServiceError(400, 'orderId is required')
  }

  if (env.useMySqlRepositories) {
    return finalizePackageOrderRefund({
      orderId,
      reason: (payload && payload.reason) || 'cloudpay refund confirmed',
      now
    })
  }

  return markPaymentRecordRefunded({
    supabase,
    orderId,
    reason: (payload && payload.reason) || 'cloudpay refund confirmed',
    now
  })
}

const markCloudPayRefundFailureResult = async ({ supabase, payload, now = new Date() }) => {
  const orderId = payload && payload.orderId
  if (!orderId) {
    throw createServiceError(400, 'orderId is required')
  }

  const order = await getOrderById({
    supabase,
    orderId
  })
  if (!order) {
    throw createServiceError(404, 'order not found')
  }

  const failurePayload = payload && payload.refundQueryResult && typeof payload.refundQueryResult === 'object'
    ? payload.refundQueryResult
    : payload || {}

  const failureReason =
    failurePayload.errmsg ||
    failurePayload.errMsg ||
    failurePayload.err_code_des ||
    failurePayload.errCodeDes ||
    failurePayload.refund_status ||
    failurePayload.status ||
    'cloudpay refund failed'

  let updatedOrder = null
  let paymentRecord = await getPaymentRecordByOrderId({
    supabase,
    orderId
  })

  if (env.useMySqlRepositories) {
    updatedOrder = await ordersRepository.updateOrder(order.id, {
      status: 'refund_failed',
      updated_at: now
    })

    if (paymentRecord) {
      const existingCallbackPayload =
        paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
          ? paymentRecord.callback_payload
          : {}
      paymentRecord = await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: 'refund_failed',
        callback_status: 'REFUND_FAILED',
        callback_payload: {
          ...existingCallbackPayload,
          refund_failure: {
            reason: `${failureReason || ''}`.trim(),
            failed_at: now.toISOString(),
            payload: failurePayload
          }
        },
        updated_at: now.toISOString()
      })
    }
  } else {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'refund_failed',
        updated_at: now.toISOString()
      })
      .eq('id', order.id)
      .select('*')
      .single()

    if (error) {
      throw error
    }

    updatedOrder = data

    if (paymentRecord) {
      const existingCallbackPayload =
        paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
          ? paymentRecord.callback_payload
          : {}
      const { data: nextPaymentRecord, error: paymentError } = await supabase
        .from('payment_records')
        .update({
          status: 'refund_failed',
          callback_status: 'REFUND_FAILED',
          callback_payload: {
            ...existingCallbackPayload,
            refund_failure: {
              reason: `${failureReason || ''}`.trim(),
              failed_at: now.toISOString(),
              payload: failurePayload
            }
          },
          updated_at: now.toISOString()
        })
        .eq('id', paymentRecord.id)
        .select('*')
        .single()

      if (paymentError) {
        throw paymentError
      }

      paymentRecord = nextPaymentRecord
    }
  }

  return {
    order: updatedOrder,
    paymentRecord
  }
}

module.exports = {
  PAYMENT_MODE_MOCK,
  PAYMENT_MODE_WECHAT,
  PAYMENT_MODE_CLOUDPAY,
  closeOrderPayment,
  createServiceError,
  prepareOrderPayment,
  getOrderPaymentStatus,
  handleCloudPayPaymentCallback,
  handleWechatPaymentCallback,
  isCloudPayPaymentMode,
  isWechatPaymentMode,
  markPaymentRecordPaid,
  markPaymentRecordRefunded,
  markCloudPayRefundResult,
  markCloudPayRefundFailureResult,
  prepareCloudPayRefund,
  prepareCloudPayUnifiedOrder
}
