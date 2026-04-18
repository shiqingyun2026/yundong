const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const loadLogger = ({ enabled }) => {
  const targets = ['config/env.js', 'shared/utils/wechatIdentity.js', 'shared/utils/miniProgramIdentityLog.js'].map(
    relativePath => require.resolve(path.join(backendRoot, relativePath))
  )

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('config/env.js', {
    env: {
      trustCloudBaseMiniProgramIdentity: true,
      enableMiniProgramIdentityLogs: enabled
    }
  })

  return require(path.join(backendRoot, 'shared/utils/miniProgramIdentityLog.js'))
}

test('mini program identity logger stays silent when disabled', () => {
  const { logMiniProgramIdentity } = loadLogger({ enabled: false })
  const calls = []
  const originalInfo = console.info
  console.info = (...args) => calls.push(args)

  try {
    logMiniProgramIdentity({
      route: '/api/orders',
      source: 'cloudbase',
      headers: {
        'x-wx-openid': 'wx-openid-1',
        'x-wx-service': 'lindong-api'
      },
      userId: 'user-1'
    })
  } finally {
    console.info = originalInfo
  }

  assert.equal(calls.length, 0)
})

test('mini program identity logger emits redacted structured payload when enabled', () => {
  const { logMiniProgramIdentity } = loadLogger({ enabled: true })
  const calls = []
  const originalInfo = console.info
  console.info = (...args) => calls.push(args)

  try {
    logMiniProgramIdentity({
      route: '/api/payments/prepare',
      source: 'cloudbase',
      headers: {
        authorization: 'Bearer token',
        'x-wx-openid': 'wx-openid-1',
        'x-wx-service': 'lindong-api'
      },
      userId: 'user-1',
      extra: {
        orderId: 'order-1'
      }
    })
  } finally {
    console.info = originalInfo
  }

  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '[miniprogram-auth]')
  assert.deepEqual(calls[0][1], {
    route: '/api/payments/prepare',
    source: 'cloudbase',
    userIdPresent: true,
    hasAuthorization: true,
    hasWechatIdentityHeaders: true,
    orderId: 'order-1'
  })
})
