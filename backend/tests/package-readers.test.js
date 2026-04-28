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

test('package readers only return packages inside the publish window for mini program home', async () => {
  clearModules([
    'config/env.js',
    'config/storage.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/cosSignedUrl.js',
    'shared/services/packageReaders.js'
  ])

  const listedArgs = []
  const cleanedArgs = []

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('config/storage.js', {
    getStorageProviderName: () => 'supabase',
    getCosStorageConfig: () => ({
      bucket: '',
      region: '',
      secretId: '',
      secretKey: '',
      expiresSeconds: 900
    })
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
            age_range: '4-8岁',
            class_count: 5,
            class_duration_minutes: 60,
            group_price_config: [
              { target_count: 2, price_fen: 6000 },
              { target_count: 4, price_fen: 5000 },
              { target_count: 6, price_fen: 5200 }
            ],
            supported_people: [2, 4, 6],
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
  assert.equal(result.list[0].age_range, '4-8岁')
  assert.equal(result.list[0].min_member_amount_fen, 5000)
  assert.equal(result.list[0].min_member_amount_text, '50.00')
})

test('package readers sign cos cover urls for private bucket access', async () => {
  clearModules([
    'config/env.js',
    'config/storage.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/cosSignedUrl.js',
    'shared/services/packageReaders.js'
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('config/storage.js', {
    getStorageProviderName: () => 'cos',
    getCosStorageConfig: () => ({
      bucket: 'demo-bucket',
      region: 'ap-shanghai',
      secretId: 'AKID_DEMO',
      secretKey: 'SECRET_DEMO',
      expiresSeconds: 900
    })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      listPackages: async () => [
        {
          id: 'pkg-cos',
          name: 'COS 图片课程',
          cover: 'https://demo-bucket.cos.ap-shanghai.myqcloud.com/course-cover/2026-04-21/cover.png',
          package_category: '体适能',
          class_count: 5,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 4, price_fen: 5000 }],
          supported_people: [4],
          location_district: '静安区',
          location_community: '云社区',
          location_detail: 'A 栋',
          latitude: 31.23,
          longitude: 121.47,
          status: 1,
          publish_time: '2026-04-21T00:00:00.000Z',
          unpublish_time: null,
          created_at: '2026-04-21T00:00:00.000Z'
        }
      ]
    },
    ordersRepository: {},
    packageGroupsRepository: {
      listPackageGroups: async () => []
    },
    usersRepository: {}
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  const { fetchMiniProgramPackageList } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageList({
    now: new Date('2026-04-21T12:00:00.000Z')
  })

  assert.equal(result.list.length, 1)
  assert.match(result.list[0].cover, /^https:\/\/demo-bucket\.cos\.ap-shanghai\.myqcloud\.com\//)
  assert.match(result.list[0].cover, /q-sign-algorithm=sha1/)
  assert.match(result.list[0].cover, /q-signature=/)
})

test('package detail hides groups once their deadline has arrived', async () => {
  clearModules([
    'config/env.js',
    'config/storage.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/cosSignedUrl.js',
    'shared/services/packageReaders.js',
    'shared/services/packageSchedule.js'
  ])

  const listedGroupArgs = []
  const now = new Date('2026-04-21T12:00:00.000Z')

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('config/storage.js', {
    getStorageProviderName: () => 'supabase',
    getCosStorageConfig: () => ({
      bucket: '',
      region: '',
      secretId: '',
      secretKey: '',
      expiresSeconds: 900
    })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260421-0001',
        name: '云test',
        total_price: 12000,
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        supported_people: [4],
        status: 1,
        publish_time: '2026-04-21T00:00:00.000Z',
        unpublish_time: null,
        location_city: '深圳市',
        location_district: '南山区',
        location_community: '科技园社区',
        location_detail: 'A场地'
      })
    },
    packageGroupsRepository: {
      listPackageGroups: async args => {
        listedGroupArgs.push(args)
        return [
          {
            id: 'group-active',
            package_id: 'PKG-20260421-0001',
            status: 'active',
            target_count: 4,
            current_count: 2,
            weekday: 6,
            hour: 10,
            deadline: '2026-04-21T13:00:00.000Z'
          },
          {
            id: 'group-deadline-arrived',
            package_id: 'PKG-20260421-0001',
            status: 'active',
            target_count: 4,
            current_count: 4,
            weekday: 7,
            hour: 10,
            deadline: '2026-04-21T12:00:00.000Z'
          }
        ]
      }
    },
    ordersRepository: {},
    usersRepository: {}
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [],
    formatPackageDateTime: value => value,
    formatPendingPackageScheduleText: () => '每周六 10:00，共5次',
    formatScheduleTextWithLockNote: () => '每周六 10:00，共5次，成团后锁定首课日期'
  })

  const { fetchMiniProgramPackageDetail } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageDetail({
    packageId: 'PKG-20260421-0001',
    now
  })

  assert.deepEqual(listedGroupArgs[0], {
    packageId: 'PKG-20260421-0001',
    statuses: ['active'],
    afterDeadline: now
  })
  assert.deepEqual(result.active_groups.map(item => item.id), ['group-active'])
  assert.equal(result.active_groups[0].remaining_seconds, 3600)
})

test('package group detail returns leader child profile, default member avatars and countdown', async () => {
  clearModules([
    'config/env.js',
    'config/storage.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/cosSignedUrl.js',
    'shared/services/packageReaders.js',
    'shared/services/packageSchedule.js'
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('config/storage.js', {
    getStorageProviderName: () => 'supabase',
    getCosStorageConfig: () => ({
      bucket: '',
      region: '',
      secretId: '',
      secretKey: '',
      expiresSeconds: 900
    })
  })

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260421-0001',
        name: '云test',
        total_price: 12000,
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        coach_name: '教练A',
        coach_intro: '<p>教练介绍</p>',
        coach_certificates: ['cert-a.png'],
        description: '<p>课程介绍</p>',
        location_city: '深圳市',
        location_district: '南山区',
        location_community: '科技园社区',
        location_detail: 'A场地'
      })
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({
        id: 'PG-20260421-00001',
        package_id: 'PKG-20260421-0001',
        status: 'active',
        target_count: 4,
        current_count: 2,
        weekday: 6,
        hour: 10,
        deadline: '2026-04-23T10:00:00.000Z',
        first_class_time: null
      })
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async () => [
        {
          user_id: 'user-1',
          package_action: 'start',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          }
        },
        {
          user_id: 'user-2',
          package_action: 'join',
          package_context: {
            child_nickname: '乐乐',
            child_age: 5
          }
        }
      ]
    },
    usersRepository: {
      listUsersByIds: async () => [
        { id: 'user-1', nickname: '微信用户1', avatar_url: 'https://example.com/1.png' },
        { id: 'user-2', nickname: '微信用户2', avatar_url: 'https://example.com/2.png' }
      ]
    }
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [],
    formatPackageDateTime: value => value,
    formatPendingPackageScheduleText: () => '每周六 10:00，共5次',
    formatScheduleTextWithLockNote: () => '每周六 10:00，共5次，成团后锁定首课日期'
  })

  const { fetchMiniProgramPackageGroupDetail } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageGroupDetail({
    packageGroupId: 'PG-20260421-00001',
    userId: 'user-2',
    now: new Date('2026-04-21T10:00:00.000Z')
  })

  assert.equal(result.package.location_text, '深圳市 / 南山区 / 科技园社区')
  assert.equal(result.package.description, '<p>课程介绍</p>')
  assert.equal(result.package.coach_name, '教练A')
  assert.equal(result.package.coach_intro, '<p>教练介绍</p>')
  assert.deepEqual(result.package.coach_certificates, ['cert-a.png'])
  assert.equal(result.child_nickname, '小满')
  assert.equal(result.child_age, 6)
  assert.equal(result.remaining_seconds, 172800)
  assert.equal(result.members.length, 2)
  assert.equal(result.members[0].nickname, '小满')
  assert.equal(result.members[0].child_age, 6)
  assert.equal(result.members[0].avatar_url, '/assets/member-default-avatar.jpg')
  assert.equal(result.members[1].nickname, '乐乐')
  assert.equal(result.members[1].child_age, 5)
})

test('user package group list returns missing count for active groups', async () => {
  clearModules([
    'config/env.js',
    'config/storage.js',
    'repositories/index.js',
    'shared/domain/packageGroupRules.js',
    'shared/services/packageGroupStore.js',
    'shared/services/cosSignedUrl.js',
    'shared/services/packageReaders.js',
    'shared/services/packageSchedule.js'
  ])

  mockModule('config/env.js', {
    env: {
      useMySqlRepositories: true
    }
  })

  mockModule('config/storage.js', {
    getStorageProviderName: () => 'supabase',
    getCosStorageConfig: () => ({
      bucket: '',
      region: '',
      secretId: '',
      secretKey: '',
      expiresSeconds: 900
    })
  })

  mockModule('repositories/index.js', {
    ordersRepository: {
      listOrders: async () => [
        {
          id: 'order-1',
          package_group_id: 'PG-20260421-00001',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          },
          updated_at: '2026-04-21T10:00:00.000Z',
          created_at: '2026-04-21T09:00:00.000Z'
        }
      ]
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({
        id: 'PG-20260421-00001',
        package_id: 'PKG-20260421-0001',
        status: 'active',
        target_count: 4,
        current_count: 2,
        weekday: 6,
        hour: 10,
        first_class_time: null
      })
    },
    coursePackagesRepository: {
      findPackagesByIds: async () => [
        {
          id: 'PKG-20260421-0001',
          name: '云test',
          total_price: 12000,
          group_price_config: [{ target_count: 4, price_fen: 3000 }],
          location_city: '深圳市',
          location_district: '南山区',
          location_community: '科技园社区',
          location_detail: '广东省深圳市南山区科技园社区 A场地'
        }
      ]
    },
    usersRepository: {}
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [],
    formatPackageDateTime: value => value,
    formatPendingPackageScheduleText: () => '每周六 10:00，共5次',
    formatScheduleTextWithLockNote: () => '每周六 10:00，共5次，成团后锁定首课日期'
  })

  const { fetchMiniProgramUserPackageGroupList } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramUserPackageGroupList({
    userId: 'user-1',
    status: 'all',
    page: 1,
    pageSize: 10,
    now: new Date('2026-04-21T12:00:00.000Z')
  })

  assert.equal(result.list.length, 1)
  assert.equal(result.list[0].order_id, 'order-1')
  assert.equal(result.list[0].target_count, 4)
  assert.equal(result.list[0].current_count, 2)
  assert.equal(result.list[0].missing_count, 2)
  assert.equal(result.list[0].location_text, '深圳市 / 南山区 / 科技园社区')
  assert.equal(result.list[0].child_nickname, '小满')
  assert.equal(result.list[0].child_age, 6)
})
