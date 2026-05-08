const http = require('node:http')
const https = require('node:https')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const DEFAULT_SUB_MCH_ID = '1111327161'
const DEFAULT_CLOUD_ENV_ID = 'tttiyubao-4g141829bdf6a28d'
const BUILD_ID = 'cloudpay-node16-http-diagnose-20260508-1118'

const readEnv = key => `${process.env[key] || ''}`.trim()

const resolveSubMchId = () => readEnv('WX_PAY_SUB_MCH_ID') || DEFAULT_SUB_MCH_ID

const resolveCloudEnvId = wxContext => readEnv('WX_CLOUD_ENV_ID') || (wxContext && wxContext.ENV) || DEFAULT_CLOUD_ENV_ID

const requestJson = ({ method = 'POST', url, headers, body }) =>
  new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'http:' ? http : https
    const hasBody = body !== undefined
    const serializedBody = hasBody ? JSON.stringify(body || {}) : ''
    const request = client.request(
      {
        method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          'Content-Type': 'application/json',
          ...(hasBody
            ? {
                'Content-Length': Buffer.byteLength(serializedBody)
              }
            : {}),
          ...(headers || {})
        }
      },
      response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let payload = {}
          try {
            payload = text ? JSON.parse(text) : {}
          } catch (error) {
            payload = {}
          }

          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            payload
          })
        })
      }
    )

    request.on('error', reject)
    if (hasBody) {
      request.write(serializedBody)
    }
    request.end()
  })

const postJson = options => requestJson({ ...(options || {}), method: 'POST' })

const requestBackend = async ({ pathname, body }) => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  const secret = readEnv('INTERNAL_PAYMENT_SECRET')
  if (!baseUrl) {
    throw new Error('LINDONG_API_BASE_URL is required')
  }
  if (!secret) {
    throw new Error('INTERNAL_PAYMENT_SECRET is required')
  }

  const response = await postJson({
    url: `${baseUrl}${pathname}`,
    headers: {
      'X-Internal-Payment-Secret': secret
    },
    body
  })
  if (!response.ok) {
    const backendMessage = response.payload.message || 'empty response'
    throw new Error(`backend request failed: ${response.status} POST ${pathname}: ${backendMessage}`)
  }
  return response.payload
}

const buildBackendUrl = pathname => `${readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')}${pathname}`

const probeBackend = async ({ method = 'POST', pathname, headers, body }) => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  if (!baseUrl) {
    return {
      ok: false,
      configured: false,
      pathname,
      message: 'LINDONG_API_BASE_URL is required'
    }
  }

  try {
    const response = await requestJson({
      method,
      url: buildBackendUrl(pathname),
      headers,
      body
    })
    return {
      ok: response.ok,
      configured: true,
      method,
      url: buildBackendUrl(pathname),
      pathname,
      status: response.status,
      message: response.payload.message || '',
      payloadCode: response.payload.code
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      method,
      url: buildBackendUrl(pathname),
      pathname,
      message: (error && error.message) || 'backend probe failed'
    }
  }
}

const preparePayment = async event => {
  const wxContext = cloud.getWXContext()
  const prepared = await requestBackend({
    pathname: '/api/payments/internal/cloudpay/prepare',
    body: {
      orderId: event.orderId,
      openId: wxContext.OPENID,
      userId: event.userId
    }
  })

  const paymentResult = await cloud.cloudPay.unifiedOrder({
    body: prepared.body,
    outTradeNo: prepared.outTradeNo,
    spbillCreateIp: event.clientIp || '127.0.0.1',
    subMchId: resolveSubMchId(),
    totalFee: Number(prepared.totalFee) || 0,
    envId: resolveCloudEnvId(wxContext),
    functionName: readEnv('WX_PAY_CALLBACK_FUNCTION') || 'wechat-pay-callback',
    attach: prepared.attach || ''
  })

  return {
    code: 0,
    data: {
      orderId: prepared.orderId,
      outTradeNo: prepared.outTradeNo,
      payment: paymentResult.payment
    }
  }
}

const refundPayment = async event => {
  const prepared = await requestBackend({
    pathname: '/api/payments/internal/cloudpay/refund/prepare',
    body: {
      orderId: event.orderId,
      reason: event.reason,
      operatorId: event.operatorId
    }
  })

  const refundResult = await cloud.cloudPay.refund({
    subMchId: resolveSubMchId(),
    outTradeNo: prepared.outTradeNo,
    outRefundNo: prepared.outRefundNo,
    totalFee: Number(prepared.totalFee) || 0,
    refundFee: Number(prepared.refundFee) || 0,
    refundDesc: prepared.refundDesc || '课程退款'
  })

  await requestBackend({
    pathname: '/api/payments/internal/cloudpay/refund/confirm',
    body: {
      orderId: prepared.orderId,
      outRefundNo: prepared.outRefundNo,
      refundResult
    }
  })

  return {
    code: 0,
    data: refundResult
  }
}

exports.main = async event => {
  const type = `${(event && event.type) || ''}`.trim()
  if (type === 'diagnose') {
    const wxContext = cloud.getWXContext()
    return {
      code: 0,
      buildId: BUILD_ID,
      envId: resolveCloudEnvId(wxContext),
      openId: wxContext.OPENID || '',
      hasFetch: typeof fetch !== 'undefined',
      hasNodeHttpClient: true
    }
  }
  if (type === 'diagnoseBackend') {
    const wxContext = cloud.getWXContext()
    const secret = readEnv('INTERNAL_PAYMENT_SECRET')
    const preparePathname = '/api/payments/internal/cloudpay/prepare'
    const prepareProbe = await probeBackend({
      pathname: preparePathname,
      headers: secret
        ? {
            'X-Internal-Payment-Secret': secret
          }
        : {},
      body: {
        orderId: event.orderId || '__diagnose__',
        openId: wxContext.OPENID || '__diagnose__'
      }
    })

    return {
      code: 0,
      buildId: BUILD_ID,
      envId: resolveCloudEnvId(wxContext),
      openId: wxContext.OPENID || '',
      backendBaseUrl: readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, ''),
      hasInternalPaymentSecret: !!secret,
      healthProbe: await probeBackend({
        method: 'GET',
        pathname: '/health'
      }),
      prepareProbe
    }
  }
  if (type === 'prepare') {
    return preparePayment(event || {})
  }
  if (type === 'refund') {
    return refundPayment(event || {})
  }
  if (type === 'queryOrder') {
    return cloud.cloudPay.queryOrder({
      subMchId: resolveSubMchId(),
      outTradeNo: event.outTradeNo
    })
  }
  if (type === 'queryRefund') {
    return cloud.cloudPay.refundQuery({
      subMchId: resolveSubMchId(),
      outRefundNo: event.outRefundNo
    })
  }
  throw new Error('unsupported wechat-pay type')
}
