const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const readEnv = key => `${process.env[key] || ''}`.trim()

const postBackendCallback = async payload => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  const secret = readEnv('INTERNAL_PAYMENT_SECRET')
  if (!baseUrl) {
    throw new Error('LINDONG_API_BASE_URL is required')
  }
  if (!secret) {
    throw new Error('INTERNAL_PAYMENT_SECRET is required')
  }

  const response = await fetch(`${baseUrl}/api/payments/internal/cloudpay/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Payment-Secret': secret
    },
    body: JSON.stringify(payload || {})
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || `backend callback failed: ${response.status}`)
  }
  return body
}

exports.main = async event => {
  try {
    await postBackendCallback(event || {})
    return {
      errcode: 0,
      errmsg: 'SUCCESS'
    }
  } catch (error) {
    console.error('[wechat-pay-callback] failed', {
      event,
      message: error && error.message
    })
    return {
      errcode: -1,
      errmsg: (error && error.message) || 'FAILED'
    }
  }
}
