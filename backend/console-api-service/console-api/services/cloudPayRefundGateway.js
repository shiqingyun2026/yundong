const { env } = require('../../config/env')
const { createConsoleApiError } = require('./_errors')
const { createWechatPayRefund, queryWechatPayRefund } = require('../../shared/services/wechatMiniProgram')

const normalizeStatusValue = value => `${value || ''}`.trim().toUpperCase()

const buildRequestError = (message, extra = {}, statusCode = 500) =>
  createConsoleApiError({
    responseCode: 5000,
    statusCode,
    message,
    extra
  })

const safeJsonParse = text => {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

const requestBackend = async ({ pathname, method = 'POST', body }) => {
  const baseUrl = `${env.lindongApiBaseUrl || ''}`.replace(/\/+$/, '')
  const secret = `${env.internalPaymentSecret || ''}`.trim()
  if (!baseUrl) {
    throw buildRequestError('LINDONG_API_BASE_URL is required for direct refund gateway')
  }
  if (!secret) {
    throw buildRequestError('INTERNAL_PAYMENT_SECRET is required for direct refund gateway')
  }

  const serializedBody = body === undefined ? undefined : JSON.stringify(body || {})
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Payment-Secret': secret
    },
    body: serializedBody
  })
  const rawText = await response.text()
  const payload = safeJsonParse(rawText)

  if (!response.ok) {
    throw buildRequestError(
      (payload && payload.message) || `backend request failed: ${response.status} ${method} ${pathname}`,
      {
        status: response.status,
        pathname,
        payload: payload || null,
        rawText
      },
      response.status >= 400 && response.status < 600 ? response.status : 500
    )
  }

  return payload || {}
}

const mapRefundQueryToBusinessStatus = refundQueryResult => {
  const queryStatus = normalizeStatusValue(refundQueryResult && refundQueryResult.status)

  if (queryStatus === 'SUCCESS') {
    return {
      queryStatus,
      settled: true,
      finalStatus: 'refunded'
    }
  }

  if (['ABNORMAL', 'CLOSED'].includes(queryStatus)) {
    return {
      queryStatus,
      settled: true,
      finalStatus: 'refund_failed'
    }
  }

  return {
    queryStatus,
    settled: false,
    finalStatus: 'refund_pending'
  }
}

const syncRefundQueryResult = async ({ orderId, outRefundNo, refundQueryResult }) => {
  const summary = mapRefundQueryToBusinessStatus(refundQueryResult)

  if (summary.finalStatus === 'refunded' && orderId) {
    await requestBackend({
      pathname: '/api/payments/internal/cloudpay/refund/confirm',
      body: {
        orderId,
        outRefundNo,
        refundQueryResult
      }
    })
  }

  if (summary.finalStatus === 'refund_failed' && orderId) {
    await requestBackend({
      pathname: '/api/payments/internal/cloudpay/refund/fail',
      body: {
        orderId,
        outRefundNo,
        refundQueryResult
      }
    })
  }

  return summary
}

const normalizeWechatPayError = (error, fallbackMessage) => {
  if (error && error.responseCode && error.statusCode) {
    throw error
  }

  const message =
    (error && error.message) ||
    (error && error.payload && (error.payload.message || error.payload.code)) ||
    fallbackMessage

  throw buildRequestError(message, {
    status: error && error.statusCode ? error.statusCode : 500,
    payload: (error && error.payload) || null,
    rawText: (error && error.rawText) || ''
  })
}

const invokeCloudPayRefund = async ({ orderId, reason, operatorId }) => {
  let prepared = null
  try {
    prepared = await requestBackend({
      pathname: '/api/payments/internal/cloudpay/refund/prepare',
      body: {
        orderId,
        reason,
        operatorId
      }
    })
  } catch (error) {
    normalizeWechatPayError(error, 'failed to prepare direct wechat refund')
  }

  let refundResult = null
  try {
    refundResult = await createWechatPayRefund({
      outTradeNo: prepared.outTradeNo,
      outRefundNo: prepared.outRefundNo,
      reason: prepared.refundDesc || reason,
      totalFee: prepared.totalFee,
      refundFee: prepared.refundFee
    })
  } catch (error) {
    normalizeWechatPayError(error, 'failed to invoke direct wechat refund')
  }

  const syncSummary = await syncRefundQueryResult({
    orderId: prepared.orderId,
    outRefundNo: prepared.outRefundNo,
    refundQueryResult: refundResult
  })

  return {
    orderId: prepared.orderId,
    outTradeNo: prepared.outTradeNo,
    outRefundNo: prepared.outRefundNo,
    status: syncSummary.finalStatus,
    accepted: true,
    settled: syncSummary.settled,
    queryStatus: syncSummary.queryStatus,
    refundResult,
    refundQueryResult: refundResult
  }
}

const queryAndSyncCloudPayRefund = async ({ orderId, outRefundNo }) => {
  let refundQueryResult = null

  try {
    refundQueryResult = await queryWechatPayRefund({
      outRefundNo
    })
  } catch (error) {
    normalizeWechatPayError(error, 'failed to query direct wechat refund')
  }

  const syncSummary = await syncRefundQueryResult({
    orderId,
    outRefundNo,
    refundQueryResult
  })

  return {
    orderId: orderId || '',
    outRefundNo: outRefundNo || '',
    queryStatus: syncSummary.queryStatus,
    settled: syncSummary.settled,
    finalStatus: syncSummary.finalStatus,
    refundQueryResult
  }
}

const diagnoseCloudPayFunctionInvocation = async () => {
  const directWechatConfig = {
    lindong_api_base_url_configured: !!`${env.lindongApiBaseUrl || ''}`.trim(),
    internal_payment_secret_configured: !!`${env.internalPaymentSecret || ''}`.trim(),
    wx_pay_mch_id_configured: !!`${process.env.WX_PAY_MCH_ID || ''}`.trim(),
    wx_pay_mch_serial_no_configured: !!`${process.env.WX_PAY_MCH_SERIAL_NO || ''}`.trim(),
    wx_pay_private_key_configured: !!`${process.env.WX_PAY_PRIVATE_KEY || ''}`.trim(),
    wx_pay_api_v3_key_configured: !!`${process.env.WX_PAY_API_V3_KEY || ''}`.trim()
  }

  const healthProbe = await requestBackend({
    pathname: '/health',
    method: 'GET'
  })

  return {
    refund_transport: 'wechatpay_v3_direct',
    lindong_api_base_url: env.lindongApiBaseUrl || '',
    direct_wechat_config: directWechatConfig,
    backend_health: healthProbe
  }
}

module.exports = {
  diagnoseCloudPayFunctionInvocation,
  invokeCloudPayRefund,
  queryAndSyncCloudPayRefund
}
