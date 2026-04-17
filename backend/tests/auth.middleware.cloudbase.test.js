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

const loadAuthenticate = ({ useMySqlRepositories = true, user = null } = {}) => {
  const targets = [
    'middleware/auth.js',
    'config/env.js',
    'repositories/usersRepository.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories
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
      'x-wx-appid': 'wx-appid-1'
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
      'x-wx-openid': 'wx-openid-missing'
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
