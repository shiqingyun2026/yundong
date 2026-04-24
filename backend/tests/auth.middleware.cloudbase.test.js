const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'lindong-api')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const loadAuthenticate = ({
  useMySqlRepositories = true,
  trustCloudBaseMiniProgramIdentity = true,
  enableMiniProgramIdentityLogs = false,
  user = null
} = {}) => {
  const targets = [
    'middleware/auth.js',
    'config/env.js',
    'shared/utils/miniProgramIdentityLog.js',
    'shared/utils/wechatIdentity.js',
    'repositories/usersRepository.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories,
      trustCloudBaseMiniProgramIdentity,
      enableMiniProgramIdentityLogs
    }
  })

  mockModule('repositories/usersRepository.js', {
    findUserByOpenId: async openId => {
      if (user && user.openid === openId) {
        return user
      }

      return null
    }
  })

  return require(path.join(backendRoot, 'middleware/auth.js'))
}

const createResponse = () => {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(value) {
      this.payload = value
      return this
    }
  }
}

test('auth middleware resolves mysql user from cloudbase openid headers', async () => {
  const authenticate = loadAuthenticate({
    useMySqlRepositories: true,
    user: {
      id: 'user-1',
      openid: 'wx-openid-1'
    }
  })

  const req = {
    headers: {
      'x-wx-openid': 'wx-openid-1',
      'x-wx-unionid': 'wx-unionid-1',
      'x-wx-appid': 'wx-appid-1',
      'x-wx-service': 'lindong-api'
    }
  }
  const res = createResponse()
  let nextCalled = false

  await authenticate(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(req.userId, 'user-1')
  assert.deepEqual(req.wechatIdentity, {
    openId: 'wx-openid-1',
    appId: 'wx-appid-1',
    unionId: 'wx-unionid-1'
  })
})

test('auth middleware rejects unknown cloudbase openid headers in mysql mode', async () => {
  const authenticate = loadAuthenticate({
    useMySqlRepositories: true,
    user: null
  })

  const req = {
    headers: {
      'x-wx-openid': 'wx-openid-missing',
      'x-wx-service': 'lindong-api'
    }
  }
  const res = createResponse()
  let nextCalled = false

  await authenticate(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.payload, {
    message: 'Unauthorized'
  })
})

test('auth middleware ignores forged cloudbase identity headers when trust is disabled', async () => {
  const authenticate = loadAuthenticate({
    useMySqlRepositories: true,
    trustCloudBaseMiniProgramIdentity: false,
    user: {
      id: 'user-1',
      openid: 'wx-openid-1'
    }
  })

  const req = {
    headers: {
      'x-wx-openid': 'wx-openid-1',
      'x-wx-service': 'lindong-api'
    }
  }
  const res = createResponse()
  let nextCalled = false

  await authenticate(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.payload, {
    message: 'Unauthorized'
  })
})

test('auth middleware ignores cloudbase openid headers without callContainer service marker', async () => {
  const authenticate = loadAuthenticate({
    useMySqlRepositories: true,
    trustCloudBaseMiniProgramIdentity: true,
    user: {
      id: 'user-1',
      openid: 'wx-openid-1'
    }
  })

  const req = {
    headers: {
      'x-wx-openid': 'wx-openid-1'
    }
  }
  const res = createResponse()
  let nextCalled = false

  await authenticate(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.payload, {
    message: 'Unauthorized'
  })
})

test('groups route accepts cloudbase identity headers without bearer token', async () => {
  const targets = [
    'routes/groups.js',
    'middleware/auth.js',
    'config/env.js',
    'utils/getSupabaseClient.js',
    'repositories/usersRepository.js',
    'shared/utils/miniProgramIdentityLog.js',
    'shared/utils/wechatIdentity.js',
    'shared/services/groupReaders.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true,
      trustCloudBaseMiniProgramIdentity: true,
      enableMiniProgramIdentityLogs: false
    }
  })

  mockModule('utils/getSupabaseClient.js', {
    getSupabaseClient: () => {
      throw new Error('supabase should not be requested in mysql mode')
    }
  })

  mockModule('repositories/usersRepository.js', {
    findUserByOpenId: async openId => {
      if (openId === 'wx-openid-1') {
        return {
          id: 'user-from-cloudbase',
          openid: openId
        }
      }

      return null
    }
  })

  mockModule('shared/services/groupReaders.js', {
    fetchMiniProgramGroupDetail: async ({ supabase, groupId, userId }) => ({
      supabaseWasPassed: supabase,
      groupId,
      userId
    })
  })

  const groupsRoutes = require(path.join(backendRoot, 'routes/groups.js'))
  const response = await groupsRoutes.fetch(
    new Request('http://127.0.0.1/group-1', {
      headers: {
        'x-wx-openid': 'wx-openid-1',
        'x-wx-service': 'lindong-api'
      }
    })
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.supabaseWasPassed, null)
  assert.equal(body.groupId, 'group-1')
  assert.equal(body.userId, 'user-from-cloudbase')
})
