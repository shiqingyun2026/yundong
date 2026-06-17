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

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  })
}

test('createPackageGroup retries with a new generated id after duplicate primary key', async () => {
  clearModules([
    'config/db.js',
    'repositories/bizSerialCountersRepository.js',
    'repositories/packageGroupsRepository.js'
  ])

  const state = {
    insertAttempts: [],
    generatedIds: ['PG-20260616-00003', 'PG-20260616-00004']
  }

  mockModule('config/db.js', {
    execute: async (sql, params) => {
      if (sql.includes('insert into package_groups')) {
        state.insertAttempts.push(params[0])
        if (params[0] === 'PG-20260616-00003') {
          const error = new Error("Duplicate entry 'PG-20260616-00003' for key 'package_groups.PRIMARY'")
          error.code = 'ER_DUP_ENTRY'
          error.errno = 1062
          throw error
        }
      }
    },
    query: async (sql, params) => {
      if (sql.includes('from package_groups')) {
        return [
          {
            id: params[0],
            package_id: 'PKG-20260531-0004',
            creator_id: 'user-1',
            target_count: 6,
            current_count: 1,
            status: 'active',
            weekday: 0,
            hour: 9,
            first_class_time: null,
            deadline: '2026-06-18 10:00:00',
            created_at: '2026-06-16 10:00:00',
            success_time: null,
            schedule_config: null
          }
        ]
      }
      return []
    }
  })

  mockModule('repositories/bizSerialCountersRepository.js', {
    buildPackageGroupId: async () => state.generatedIds.shift()
  })

  const { createPackageGroup } = require(path.join(backendRoot, 'repositories/packageGroupsRepository.js'))
  const result = await createPackageGroup({
    package_id: 'PKG-20260531-0004',
    creator_id: 'user-1',
    target_count: 6,
    current_count: 1,
    status: 'active',
    hour: 9,
    deadline: new Date('2026-06-18T10:00:00.000Z'),
    created_at: new Date('2026-06-16T10:00:00.000Z')
  })

  assert.deepEqual(state.insertAttempts, ['PG-20260616-00003', 'PG-20260616-00004'])
  assert.equal(result.id, 'PG-20260616-00004')
})
