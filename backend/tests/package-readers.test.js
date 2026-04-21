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

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  })
}

test('package readers only return packages inside the publish window for mini program home', async () => {
  clearModules([
    'config/env.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/packageReaders.js'
  ])

  const listedArgs = []
  const cleanedArgs = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      listPackages: async args => {
        listedArgs.push(args)
        return [
          {
            id: 'pkg-visible',
            name: '云test',
            cover: 'https://example.com/visible.jpg',
            package_category: '体适能',
            class_count: 5,
            class_duration_minutes: 60,
            group_price_config: [{ target_count: 4, price_fen: 5000 }],
            supported_people: [4],
            location_district: '龙岗区',
            location_community: '云社区',
            location_detail: 'A 栋',
            latitude: 22.6,
            longitude: 114.2,
            status: 1,
            publish_time: '2026-04-21T00:00:00.000Z',
            unpublish_time: null,
            created_at: '2026-04-20T00:00:00.000Z'
          },
          {
            id: 'pkg-pending',
            name: '未来上架课包',
            cover: 'https://example.com/pending.jpg',
            package_category: '体适能',
            class_count: 5,
            class_duration_minutes: 60,
            group_price_config: [{ target_count: 4, price_fen: 4000 }],
            supported_people: [4],
            location_district: '龙岗区',
            location_community: '云社区',
            location_detail: 'B 栋',
            latitude: 22.61,
            longitude: 114.21,
            status: 1,
            publish_time: '2026-04-23T00:00:00.000Z',
            unpublish_time: null,
            created_at: '2026-04-20T01:00:00.000Z'
          },
          {
            id: 'pkg-offline',
            name: '已下架课包',
            cover: 'https://example.com/offline.jpg',
            package_category: '体适能',
            class_count: 5,
            class_duration_minutes: 60,
            group_price_config: [{ target_count: 4, price_fen: 3000 }],
            supported_people: [4],
            location_district: '龙岗区',
            location_community: '云社区',
            location_detail: 'C 栋',
            latitude: 22.62,
            longitude: 114.22,
            status: 1,
            publish_time: '2026-04-19T00:00:00.000Z',
            unpublish_time: '2026-04-20T00:00:00.000Z',
            created_at: '2026-04-19T00:00:00.000Z'
          }
        ]
      }
    },
    ordersRepository: {},
    packageGroupsRepository: {
      listPackageGroups: async ({ packageIds }) =>
        packageIds.map(packageId => ({
          id: `group-${packageId}`,
          package_id: packageId,
          status: 'active',
          deadline: '2026-04-22T00:00:00.000Z'
        }))
    },
    usersRepository: {}
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async args => {
      cleanedArgs.push(args)
    }
  })

  const { fetchMiniProgramPackageList } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageList({
    now: new Date('2026-04-21T12:00:00.000Z')
  })

  assert.equal(listedArgs.length, 1)
  assert.deepEqual(listedArgs[0], {
    keyword: '',
    category: '',
    district: '',
    status: 1
  })
  assert.equal(cleanedArgs.length, 1)
  assert.deepEqual(cleanedArgs[0], {
    packageIds: ['pkg-visible'],
    now: new Date('2026-04-21T12:00:00.000Z')
  })
  assert.equal(result.total, 1)
  assert.equal(result.list.length, 1)
  assert.equal(result.list[0].id, 'pkg-visible')
  assert.equal(result.list[0].name, '云test')
})
