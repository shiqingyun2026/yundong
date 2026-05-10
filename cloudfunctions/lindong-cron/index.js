const http = require('node:http')
const https = require('node:https')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const BUILD_ID = 'lindong-cron-20260509-01'

const readEnv = key => `${process.env[key] || ''}`.trim()

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

const resolveBaseUrl = () => {
  const baseUrl = readEnv('LINDONG_API_BASE_URL').replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error('LINDONG_API_BASE_URL is required')
  }
  return baseUrl
}

const resolveCronSecret = () => {
  const cronSecret = readEnv('CRON_SECRET')
  if (!cronSecret) {
    throw new Error('CRON_SECRET is required')
  }
  return cronSecret
}

const buildTargets = event => {
  if (event && Array.isArray(event.targets) && event.targets.length) {
    return event.targets
  }

  return ['/api/internal/group-result-notifications/process']
}

const postInternalApi = async ({ pathname, body }) => {
  const response = await requestJson({
    method: 'POST',
    url: `${resolveBaseUrl()}${pathname}`,
    headers: {
      Authorization: `Bearer ${resolveCronSecret()}`
    },
    body: body || {}
  })

  if (!response.ok) {
    const message = response.payload.message || `request failed: ${response.status}`
    throw new Error(`${pathname}: ${message}`)
  }

  return response.payload
}

exports.main = async event => {
  if (event && event.type === 'diagnose') {
    return {
      code: 0,
      buildId: BUILD_ID,
      baseUrlConfigured: !!readEnv('LINDONG_API_BASE_URL'),
      cronSecretConfigured: !!readEnv('CRON_SECRET'),
      defaultTargets: buildTargets({})
    }
  }

  const targets = buildTargets(event || {})
  const results = []

  for (const pathname of targets) {
    try {
      const payload = await postInternalApi({
        pathname,
        body: event && event.body && typeof event.body === 'object' ? event.body : {}
      })

      results.push({
        pathname,
        ok: true,
        payload
      })
    } catch (error) {
      console.error('[lindong-cron] target failed', {
        pathname,
        message: error && error.message
      })

      results.push({
        pathname,
        ok: false,
        message: (error && error.message) || 'unknown error'
      })
    }
  }

  const hasFailure = results.some(item => !item.ok)
  return {
    code: hasFailure ? -1 : 0,
    buildId: BUILD_ID,
    results
  }
}
