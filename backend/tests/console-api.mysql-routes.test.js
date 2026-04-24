const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'console-api-mysql-routes-secret'
process.env.ADMIN_LOGIN_MAX_FAILURES = process.env.ADMIN_LOGIN_MAX_FAILURES || '3'
process.env.ADMIN_LOGIN_WINDOW_MS = process.env.ADMIN_LOGIN_WINDOW_MS || '60000'
process.env.ADMIN_LOGIN_LOCKOUT_MS = process.env.ADMIN_LOGIN_LOCKOUT_MS || '60000'

const backendRoot = path.resolve(__dirname, '..', 'console-api-service')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const loadConsoleApiAppForMysqlRoutes = () => {
  const targets = [
    'console-api/app.js',
    'console-api/routes/index.js',
    'console-api/routes/auth.js',
    'console-api/routes/accounts.js',
    'console-api/controllers/authController.js',
    'console-api/controllers/accountsController.js',
    'console-api/controllers/_helpers.js',
    'console-api/services/authService.js',
    'console-api/services/accountService.js',
    'console-api/services/loginRateLimiter.js',
    'console-api/services/_errors.js',
    'middleware/adminAuth.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('console-api/services/authService.js', {
    loginAdmin: async ({ username, password, ip }) => {
      if (!username || !password || password !== 'good-password') {
        const error = new Error('用户名或密码错误')
        error.responseCode = 1001
        error.statusCode = 400
        throw error
      }

      return {
        token: jwt.sign(
          {
            type: 'admin',
            adminId: 'admin-super',
            username,
            role: 'super_admin'
          },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        ),
        user: {
          id: 'admin-super',
          username,
          role: 'super_admin',
          ip
        }
      }
    }
  })

  mockModule('console-api/services/accountService.js', {
    listAccountPage: async ({ query = {} }) => ({
      total: 1,
      page: Number(query.page || 1) || 1,
      size: Number(query.size || 10) || 10,
      total_pages: 1,
      list: [
        {
          id: 'admin-super',
          username: 'root',
          role: 'super_admin',
          status: 'active',
          last_login_time: '',
          create_time: ''
        }
      ]
    }),
    createAccount: async ({ actorAdmin, payload }) => ({
      id: 'admin-created',
      actorAdmin,
      payload
    }),
    updateAccountById: async ({ accountId }) => ({
      id: accountId
    }),
    deleteAccountById: async ({ accountId }) => ({
      id: accountId
    })
  })

  return require(path.join(backendRoot, 'console-api/app.js'))
}

const requestJson = async ({ app, method = 'GET', pathname, body, headers = {} }) => {
  const requestHeaders = new Headers(headers)

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await app.fetch(
    new Request(`http://127.0.0.1${pathname}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  )

  return {
    status: response.status,
    body: await response.json()
  }
}

test('console api mysql routes: login returns admin session cookie and user envelope', async () => {
  const app = loadConsoleApiAppForMysqlRoutes()

  const response = await app.fetch(
    new Request('http://127.0.0.1/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'root',
        password: 'good-password'
      })
    })
  )
  const login = {
    status: response.status,
    body: await response.json()
  }
  const setCookie = response.headers.get('set-cookie') || ''

  assert.equal(login.status, 200)
  assert.equal(login.body.code, 0)
  assert.equal(login.body.data.user.username, 'root')
  assert.equal(login.body.data.token, undefined)
  assert.match(setCookie, /console_admin_token=/)
  assert.match(setCookie, /HttpOnly/)

  const token = decodeURIComponent(setCookie.match(/console_admin_token=([^;]+)/)?.[1] || '')
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  assert.equal(payload.type, 'admin')
  assert.equal(payload.adminId, 'admin-super')
  assert.equal(payload.role, 'super_admin')
})

test('console api mysql routes: accounts endpoint requires admin bearer token', async () => {
  const app = loadConsoleApiAppForMysqlRoutes()

  const accounts = await requestJson({
    app,
    pathname: '/api/admin/accounts'
  })

  assert.equal(accounts.status, 401)
  assert.deepEqual(accounts.body, {
    code: 1002,
    message: 'token无效或过期'
  })
})

test('console api mysql routes: super admin token can access accounts list', async () => {
  const app = loadConsoleApiAppForMysqlRoutes()
  const token = jwt.sign(
    {
      type: 'admin',
      adminId: 'admin-super',
      username: 'root',
      role: 'super_admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  const accounts = await requestJson({
    app,
    pathname: '/api/admin/accounts?page=2&size=20',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  assert.equal(accounts.status, 200)
  assert.equal(accounts.body.code, 0)
  assert.equal(accounts.body.data.page, 2)
  assert.equal(accounts.body.data.size, 20)
  assert.equal(accounts.body.data.list[0].username, 'root')
})

test('console api mysql routes: non-super admin token is rejected by accounts list', async () => {
  const app = loadConsoleApiAppForMysqlRoutes()
  const token = jwt.sign(
    {
      type: 'admin',
      adminId: 'admin-normal',
      username: 'operator',
      role: 'admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  const accounts = await requestJson({
    app,
    pathname: '/api/admin/accounts',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  assert.equal(accounts.status, 403)
  assert.deepEqual(accounts.body, {
    code: 1003,
    message: '无权限操作'
  })
})
