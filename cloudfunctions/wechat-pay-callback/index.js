const http = require('node:http')
const https = require('node:https')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const readEnv = key => `${process.env[key] || ''}`.trim()

const postJson = ({ url, headers, body }) =>
  new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'http:' ? http : https
    const serializedBody = JSON.stringify(body || {})
    const request = client.request(
      {
        method: 'POST',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(serializedBody),
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
    request.write(serializedBody)
    request.end()
  })

const postBackendCallback = async payload => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  const secret = readEnv('INTERNAL_PAYMENT_SECRET')
  if (!baseUrl) {
    throw new Error('LINDONG_API_BASE_URL is required')
  }
  if (!secret) {
    throw new Error('INTERNAL_PAYMENT_SECRET is required')
  }

  const response = await postJson({
    url: `${baseUrl}/api/payments/internal/cloudpay/callback`,
    headers: {
      'X-Internal-Payment-Secret': secret
    },
    body: payload || {}
  })
  if (!response.ok) {
    throw new Error(response.payload.message || `backend callback failed: ${response.status}`)
  }
  return response.payload
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
