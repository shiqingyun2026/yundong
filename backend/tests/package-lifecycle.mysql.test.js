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

const loadPackageLifecycle = ({ packages = [], adminLogCalls = [], useMySqlRepositories = true } = {}) => {
  const targetPaths = [
    'utils/packageLifecycle.js',
    'config/env.js',
    'repositories/index.js',
    'utils/adminStore.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targetPaths.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  const updatedPackageStatuses = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackagesByIds: async ids => packages.filter(item => ids.includes(item.id)),
      listPackages: async () => packages,
      updatePackageStatus: async (id, status) => {
        updatedPackageStatuses.push({ id, status })
        return { id, status }
      }
    }
  })

  mockModule('utils/adminStore.js', {
    writeAdminLog: async payload => {
      adminLogCalls.push(payload)
    }
  })

  const lifecycle = require(path.join(backendRoot, 'utils/packageLifecycle.js'))

  return {
    ...lifecycle,
    updatedPackageStatuses
  }
}

test('package lifecycle sync writes pending package to active in mysql mode', async () => {
  const adminLogCalls = []
  const { syncAllPackageLifecycles, updatedPackageStatuses } = loadPackageLifecycle({
    packages: [
      {
        id: 'pkg-1',
        publish_time: '2026-04-21T08:00:00+08:00',
        unpublish_time: '2026-04-22T08:00:00+08:00',
        status: 2
      }
    ],
    adminLogCalls
  })

  const result = await syncAllPackageLifecycles({
    now: new Date('2026-04-21T10:00:00+08:00'),
    operatorId: 'admin-1'
  })

  assert.equal(result['pkg-1'].status, 1)
  assert.deepEqual(updatedPackageStatuses, [{ id: 'pkg-1', status: 1 }])
  assert.equal(adminLogCalls.length, 1)
  assert.equal(adminLogCalls[0].action, 'package_status_sync')
})

test('package lifecycle sync writes active package to inactive after unpublish time', async () => {
  const { syncAllPackageLifecycles, updatedPackageStatuses } = loadPackageLifecycle({
    packages: [
      {
        id: 'pkg-2',
        publish_time: '2026-04-20T08:00:00+08:00',
        unpublish_time: '2026-04-21T08:00:00+08:00',
        status: 1
      }
    ]
  })

  const result = await syncAllPackageLifecycles({
    now: new Date('2026-04-21T10:00:00+08:00')
  })

  assert.equal(result['pkg-2'].status, 0)
  assert.deepEqual(updatedPackageStatuses, [{ id: 'pkg-2', status: 0 }])
})
