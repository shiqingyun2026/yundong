const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'console-api-auth-mysql-secret'

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

const loadAuthServiceWithMysql = ({ findAdminByUsernameImpl, verifyPasswordImpl } = {}) => {
  process.env.USE_MYSQL_REPOSITORIES = 'true'

  const targets = [
    'config/env.js',
    'console-api/services/authService.js',
    'console-api/services/_guards.js',
    'utils/adminStore.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targets.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  const state = {
    bootstrapCalls: 0,
    touchCalls: [],
    logCalls: []
  }

  mockModule('utils/adminStore.js', {
    ensureBootstrapAdminExists: async () => {
      state.bootstrapCalls += 1
      return {
        mode: 'existing',
        admin: {
          id: 'admin-super',
          username: 'admin',
          role: 'super_admin'
        }
      }
    },
    findAdminByUsername: findAdminByUsernameImpl
      || (async username => ({
        id: 'admin-super',
        username,
        role: 'super_admin',
        status: 'active',
        password_hash: 'stub-hash'
      })),
    hasAdminPasswordColumn: async () => true,
    touchAdminLogin: async adminId => {
      state.touchCalls.push(adminId)
    },
    verifyPassword: verifyPasswordImpl || (() => true),
    writeAdminLog: async payload => {
      state.logCalls.push(payload)
    }
  })

  return {
    state,
    authService: require(path.join(backendRoot, 'console-api/services/authService.js'))
  }
}

test('console api auth service: mysql mode ensures bootstrap admin before login', async () => {
  const { state, authService } = loadAuthServiceWithMysql()

  const result = await authService.loginAdmin({
    username: 'admin',
    password: 'admin123456',
    ip: '127.0.0.1'
  })

  assert.equal(state.bootstrapCalls, 1)
  assert.equal(state.touchCalls.length, 1)
  assert.equal(state.touchCalls[0], 'admin-super')
  assert.equal(state.logCalls.length, 1)
  assert.equal(result.user.username, 'admin')
  assert.equal(result.user.role, 'super_admin')
  assert.equal(typeof result.token, 'string')
})

test('console api auth service: mysql mode still rejects invalid password', async () => {
  const { state, authService } = loadAuthServiceWithMysql({
    verifyPasswordImpl: () => false
  })

  await assert.rejects(
    () =>
      authService.loginAdmin({
        username: 'admin',
        password: 'bad-password',
        ip: '127.0.0.1'
      }),
    error => error && error.message === '用户名或密码错误'
  )

  assert.equal(state.bootstrapCalls, 1)
  assert.equal(state.touchCalls.length, 0)
  assert.equal(state.logCalls.length, 0)
})
