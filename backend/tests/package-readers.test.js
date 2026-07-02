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

const withTimezone = async (timezone, run) => {
  const previousTimezone = process.env.TZ
  process.env.TZ = timezone

  try {
    return await run()
  } finally {
    if (previousTimezone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = previousTimezone
    }
  }
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
            wechat_share_cover: 'https://example.com/visible-share.jpg',
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
            wechat_share_cover: 'https://example.com/pending-share.jpg',
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
            wechat_share_cover: 'https://example.com/offline-share.jpg',
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
        cover: 'https://example.com/detail-cover.jpg',
        wechat_share_cover: 'https://example.com/detail-share-cover.jpg',
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
            id: 'group-empty',
            package_id: 'PKG-20260421-0001',
            status: 'active',
            target_count: 4,
            current_count: 0,
            weekday: 6,
            hour: 11,
            deadline: '2026-04-21T14:00:00.000Z'
          },
          {
            id: 'group-canceled',
            package_id: 'PKG-20260421-0001',
            status: 'canceled',
            target_count: 4,
            current_count: 1,
            weekday: 6,
            hour: 12,
            deadline: '2026-04-21T15:00:00.000Z'
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
  assert.equal(result.cover, 'https://example.com/detail-cover.jpg')
  assert.equal(result.wechat_share_cover, 'https://example.com/detail-share-cover.jpg')
  assert.deepEqual(result.active_groups.map(item => item.id), ['group-active'])
  assert.equal(result.active_groups[0].remaining_seconds, 3600)
})

test('package readers treat MySQL DATETIME publish window as Shanghai time under UTC runtime', async () => {
  await withTimezone('UTC', async () => {
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
        listPackages: async () => [
          {
            id: 'pkg-datetime-pending',
            name: '待上架课包',
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
            publish_time: '2026-04-21 10:00:00',
            unpublish_time: null,
            created_at: '2026-04-20 09:00:00'
          },
          {
            id: 'pkg-datetime-active',
            name: '已上架课包',
            cover: 'https://example.com/active.jpg',
            package_category: '体适能',
            class_count: 5,
            class_duration_minutes: 60,
            group_price_config: [{ target_count: 2, price_fen: 5000 }],
            supported_people: [2],
            location_district: '龙岗区',
            location_community: '云社区',
            location_detail: 'A 栋',
            latitude: 22.6,
            longitude: 114.2,
            status: 1,
            publish_time: '2026-04-21 08:00:00',
            unpublish_time: null,
            created_at: '2026-04-20 08:00:00'
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
      now: new Date('2026-04-21T01:30:00.000Z')
    })

    assert.deepEqual(result.list.map(item => item.id), ['pkg-datetime-active'])
  })
})

test('package readers sort home packages by distance asc, then price asc, then created time desc', async () => {
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
      listPackages: async () => [
        {
          id: 'pkg-near-expensive',
          name: '近距离高价课包',
          cover: 'https://example.com/near-expensive.jpg',
          package_category: '体适能',
          class_count: 5,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 4, price_fen: 6000 }],
          supported_people: [4],
          location_district: '南山区',
          location_community: '社区A',
          location_detail: 'A场地',
          latitude: 22.6000,
          longitude: 114.2000,
          status: 1,
          publish_time: '2026-04-21T00:00:00.000Z',
          unpublish_time: null,
          created_at: '2026-04-21T08:00:00.000Z'
        },
        {
          id: 'pkg-near-cheap-old',
          name: '近距离低价旧课包',
          cover: 'https://example.com/near-cheap-old.jpg',
          package_category: '体适能',
          class_count: 5,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 4, price_fen: 4000 }],
          supported_people: [4],
          location_district: '南山区',
          location_community: '社区B',
          location_detail: 'B场地',
          latitude: 22.6000,
          longitude: 114.2000,
          status: 1,
          publish_time: '2026-04-21T00:00:00.000Z',
          unpublish_time: null,
          created_at: '2026-04-21T07:00:00.000Z'
        },
        {
          id: 'pkg-near-cheap-new',
          name: '近距离低价新课包',
          cover: 'https://example.com/near-cheap-new.jpg',
          package_category: '体适能',
          class_count: 5,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 4, price_fen: 4000 }],
          supported_people: [4],
          location_district: '南山区',
          location_community: '社区C',
          location_detail: 'C场地',
          latitude: 22.6000,
          longitude: 114.2000,
          status: 1,
          publish_time: '2026-04-21T00:00:00.000Z',
          unpublish_time: null,
          created_at: '2026-04-21T09:00:00.000Z'
        },
        {
          id: 'pkg-far-cheapest',
          name: '远距离最低价课包',
          cover: 'https://example.com/far-cheapest.jpg',
          package_category: '体适能',
          class_count: 5,
          class_duration_minutes: 60,
          group_price_config: [{ target_count: 4, price_fen: 3000 }],
          supported_people: [4],
          location_district: '宝安区',
          location_community: '社区D',
          location_detail: 'D场地',
          latitude: 22.6100,
          longitude: 114.2100,
          status: 1,
          publish_time: '2026-04-21T00:00:00.000Z',
          unpublish_time: null,
          created_at: '2026-04-21T10:00:00.000Z'
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
    latitude: 22.6000,
    longitude: 114.2000,
    now: new Date('2026-04-21T12:00:00.000Z')
  })

  assert.deepEqual(result.list.map(item => item.id), [
    'pkg-near-cheap-new',
    'pkg-near-cheap-old',
    'pkg-near-expensive',
    'pkg-far-cheapest'
  ])
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
        wechat_share_cover: 'https://example.com/group-share-cover.png',
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
        min_success_count: 3,
        current_count: 2,
        weekday: 6,
        hour: 10,
        deadline: '2026-04-23T10:00:00.000Z',
        first_class_time: null,
        schedule_config: {
          schedule_type: 'weekly',
          schedule_time: '10:00',
          schedule_days: [6],
          class_count: 5,
          location_id: 'PKG-20260421-0001-loc-002',
          location_snapshot: {
            id: 'PKG-20260421-0001-loc-002',
            location_district: '广东省 / 深圳市 / 龙岗区',
            location_community: '大世纪水山缘',
            location_detail: '大世纪水山缘 广东省深圳市龙岗区龙山商业街1'
          }
        }
      })
    },
    ordersRepository: {
      listOrders: async () => [],
      listOrdersByPackageGroupId: async () => [
        {
          id: 'order-1',
          user_id: 'user-1',
          package_action: 'start',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          }
        },
        {
          id: 'order-2',
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

  assert.equal(result.location_id, 'PKG-20260421-0001-loc-002')
  assert.equal(result.location_text, '深圳市 / 龙岗区 / 大世纪水山缘')
  assert.equal(result.location_snapshot.location_community, '大世纪水山缘')
  assert.equal(result.package.location_text, '深圳市 / 龙岗区 / 大世纪水山缘')
  assert.equal(result.package.wechat_share_cover, 'https://example.com/group-share-cover.png')
  assert.equal(result.package.description, '<p>课程介绍</p>')
  assert.equal(result.package.coach_name, '教练A')
  assert.equal(result.package.coach_intro, '<p>教练介绍</p>')
  assert.deepEqual(result.package.coach_certificates, ['cert-a.png'])
  assert.equal(result.child_nickname, '小满')
  assert.equal(result.child_age, 6)
  assert.equal(result.remaining_seconds, 172800)
  assert.equal(result.members.length, 2)
  assert.equal(result.members[0].nickname, '小满')
  assert.equal(result.members[0].order_id, 'order-1')
  assert.equal(result.members[0].display_name_masked, '小*')
  assert.equal(result.members[0].child_age, 6)
  assert.equal(result.members[0].avatar_url, '/assets/member-default-avatar.jpg')
  assert.equal(result.members[1].nickname, '乐乐')
  assert.equal(result.members[1].order_id, 'order-2')
  assert.equal(result.members[1].display_name_masked, '乐*')
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
        min_success_count: 3,
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
  assert.equal(result.list[0].min_success_count, 3)
  assert.equal(result.list[0].current_count, 2)
  assert.equal(result.list[0].missing_count, 1)
  assert.equal(result.list[0].location_text, '深圳市 / 南山区 / 科技园社区')
  assert.equal(result.list[0].child_nickname, '小满')
  assert.equal(result.list[0].child_nickname_masked, '小*')
  assert.equal(result.list[0].child_age, 6)
})

test('mini program user package group list exposes refund display states and preserves order-created sorting', async () => {
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
          id: 'order-success',
          package_group_id: 'PG-success',
          status: 'success',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          },
          created_at: '2026-04-21T08:00:00.000Z',
          updated_at: '2026-04-21T11:00:00.000Z'
        },
        {
          id: 'order-refund-pending',
          package_group_id: 'PG-refund-pending',
          status: 'refund_pending',
          package_context: {
            child_nickname: '乐乐',
            child_age: 5
          },
          created_at: '2026-04-21T10:00:00.000Z',
          updated_at: '2026-04-21T10:01:00.000Z'
        },
        {
          id: 'order-refunded',
          package_group_id: 'PG-refunded',
          status: 'refunded',
          package_context: {
            child_nickname: '可可',
            child_age: 4
          },
          created_at: '2026-04-21T09:00:00.000Z',
          updated_at: '2026-04-21T12:00:00.000Z'
        }
      ]
    },
    packageGroupsRepository: {
      findPackageGroupById: async id => ({
        'PG-success': {
          id: 'PG-success',
          package_id: 'PKG-1',
          status: 'active',
          target_count: 4,
          current_count: 2,
          weekday: 6,
          hour: 10,
          first_class_time: null
        },
        'PG-refund-pending': {
          id: 'PG-refund-pending',
          package_id: 'PKG-1',
          status: 'active',
          target_count: 4,
          current_count: 1,
          weekday: 6,
          hour: 10,
          first_class_time: null
        },
        'PG-refunded': {
          id: 'PG-refunded',
          package_id: 'PKG-1',
          status: 'failed',
          target_count: 4,
          current_count: 0,
          weekday: 6,
          hour: 10,
          first_class_time: null
        }
      }[id] || null)
    },
    coursePackagesRepository: {
      findPackagesByIds: async () => [
        {
          id: 'PKG-1',
          name: '云test',
          total_price: 12000,
          age_range: '4-8岁',
          group_price_config: [{ target_count: 4, price_fen: 3000 }],
          location_city: '深圳市',
          location_district: '南山区',
          location_community: '科技园社区',
          location_detail: 'A场地'
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

  assert.deepEqual(
    result.list.map(item => item.order_id),
    ['order-refund-pending', 'order-refunded', 'order-success']
  )
  assert.deepEqual(
    result.list.map(item => item.status),
    ['refund_pending', 'refunded', 'active']
  )
  assert.equal(result.list[0].order_status, 'refund_pending')
  assert.equal(result.list[0].group_status, 'active')
  assert.equal(result.list[0].can_open_detail, false)
  assert.equal(result.list[1].can_open_detail, false)
  assert.equal(result.list[2].can_open_detail, true)
})

test('mini program user package group list prefers schedule config when first class time is not locked', async () => {
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
          id: 'order-weekly-config',
          package_group_id: 'PG-weekly-config',
          status: 'success',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          },
          created_at: '2026-04-21T08:00:00.000Z'
        }
      ]
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({
        id: 'PG-weekly-config',
        package_id: 'PKG-1',
        status: 'active',
        target_count: 4,
        current_count: 2,
        weekday: 0,
        hour: 9,
        first_class_time: null,
        schedule_config: {
          schedule_type: 'weekly',
          schedule_time: '09:30',
          schedule_days: [2, 4],
          class_count: 3
        }
      })
    },
    coursePackagesRepository: {
      findPackagesByIds: async () => [
        {
          id: 'PKG-1',
          name: '云test',
          class_count: 3,
          total_price: 12000,
          group_price_config: [{ target_count: 4, price_fen: 3000 }],
          location_city: '深圳市',
          location_district: '南山区',
          location_community: '科技园社区',
          location_detail: 'A场地'
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
    formatPendingPackageScheduleText: ({ scheduleConfig, classCount }) =>
      `${scheduleConfig.schedule_time}|${(scheduleConfig.schedule_days || []).join(',')}|${classCount}`,
    formatScheduleTextWithLockNote: () => 'unused'
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
  assert.equal(result.list[0].display_time_text, '09:30|2,4|3')
})

test('package group detail returns ended groups and still rejects refunded viewers', async () => {
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

  let currentGroup = {
    id: 'PG-hidden',
    package_id: 'PKG-20260421-0001',
    status: 'canceled',
    target_count: 4,
    current_count: 0,
    weekday: 6,
    hour: 10,
    deadline: '2026-04-23T10:00:00.000Z',
    first_class_time: null
  }

  mockModule('repositories/index.js', {
    coursePackagesRepository: {
      findPackageById: async () => ({
        id: 'PKG-20260421-0001',
        name: '云test',
        total_price: 12000,
        group_price_config: [{ target_count: 4, price_fen: 3000 }]
      })
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({ ...currentGroup })
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async () => [],
      listOrders: async () => [
        {
          id: 'order-refunded',
          status: 'refunded',
          package_group_id: 'PG-hidden'
        }
      ]
    },
    usersRepository: {
      listUsersByIds: async () => []
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

  const endedResult = await fetchMiniProgramPackageGroupDetail({
    packageGroupId: 'PG-hidden',
    userId: '',
    now: new Date('2026-04-21T10:00:00.000Z')
  })

  assert.equal(endedResult.id, 'PG-hidden')
  assert.equal(endedResult.status, 'canceled')
  assert.equal(endedResult.current_count, 0)
  assert.equal(endedResult.package.id, 'PKG-20260421-0001')

  currentGroup = {
    ...currentGroup,
    id: 'PG-visible',
    status: 'active',
    current_count: 2
  }

  await assert.rejects(
    () =>
      fetchMiniProgramPackageGroupDetail({
        packageGroupId: 'PG-visible',
        userId: 'user-1',
        now: new Date('2026-04-21T10:00:00.000Z')
      }),
    error => {
      assert.equal(error.code, 2006)
      return true
    }
  )
})

test('trial package group detail returns a single-session schedule', async () => {
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
        id: 'PKG-TRIAL-0001',
        name: '周末体验课',
        package_category: '体验课',
        class_count: 1,
        total_price: 12000,
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        location_city: '深圳市',
        location_district: '广东省 / 深圳市 / 南山区',
        location_community: '科技园社区'
      })
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({
        id: 'PG-TRIAL-0001',
        package_id: 'PKG-TRIAL-0001',
        status: 'active',
        target_count: 4,
        current_count: 1,
        weekday: 0,
        hour: 10,
        deadline: '2026-04-23T10:00:00.000Z',
        first_class_time: '2026-04-24 10:00:00',
        schedule_config: {
          schedule_type: 'single',
          schedule_date: '2026-04-24',
          schedule_time: '10:00',
          schedule_days: [],
          class_count: 1
        }
      })
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async () => [
        {
          id: 'order-trial-start',
          user_id: 'user-1',
          package_action: 'start',
          package_context: {
            child_nickname: '小满',
            child_age: 6
          }
        }
      ],
      listOrders: async () => []
    },
    usersRepository: {
      listUsersByIds: async () => [{ id: 'user-1', nickname: '微信用户1', avatar_url: 'https://example.com/1.png' }]
    }
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [{ index: 1, class_time: '2026-04-24 10:00:00', display_text: '2026-04-24 10:00:00' }],
    formatPackageDateTime: value => value,
    formatPendingPackageScheduleText: () => '每周六 10:00，共5次',
    formatScheduleTextWithLockNote: () => '每周六 10:00，共5次，成团后锁定首课日期'
  })

  const { fetchMiniProgramPackageGroupDetail } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageGroupDetail({
    packageGroupId: 'PG-TRIAL-0001',
    userId: '',
    now: new Date('2026-04-21T10:00:00.000Z')
  })

  assert.equal(result.schedule_mode, 'single_session')
  assert.equal(result.schedule_text, '上课时间 2026-04-24 10:00:00')
  assert.equal(result.schedule_list.length, 1)
})

test('package group detail keeps pending schedule text before first class time is locked', async () => {
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
        id: 'PKG-PENDING-0001',
        name: '周中晚课包',
        cover: 'https://example.com/package-cover.png',
        wechat_share_cover: 'https://example.com/package-share-cover.png',
        age_range: '4-8岁',
        class_count: 3,
        total_price: 9000,
        group_price_config: [{ target_count: 4, price_fen: 3000 }],
        coach_name: '教练A',
        coach_intro: '<p>教练介绍</p>',
        coach_certificates: [],
        description: '<p>课程介绍</p>',
        location_city: '深圳市',
        location_district: '南山区',
        location_community: '科技园社区',
        location_detail: 'A场地'
      })
    },
    packageGroupsRepository: {
      findPackageGroupById: async () => ({
        id: 'PG-PENDING-0001',
        package_id: 'PKG-PENDING-0001',
        status: 'active',
        target_count: 4,
        current_count: 2,
        weekday: 0,
        hour: 9,
        deadline: '2026-04-23 10:00:00',
        first_class_time: null,
        schedule_config: {
          schedule_type: 'weekly',
          schedule_time: '09:30',
          schedule_days: [2, 4],
          class_count: 3
        }
      })
    },
    ordersRepository: {
      listOrdersByPackageGroupId: async ({ status }) =>
        status === 'success'
          ? [
              {
                id: 'order-start',
                user_id: 'user-1',
                package_action: 'start',
                package_context: {
                  child_nickname: '小满',
                  child_age: 6
                }
              }
            ]
          : [],
      listOrders: async () => []
    },
    usersRepository: {
      listUsersByIds: async () => [{ id: 'user-1', nickname: '微信用户1' }]
    }
  })

  mockModule('shared/domain/packageGroupRules.js', {
    calculatePackageMemberAmountFen: ({ groupPriceConfig = [] }) => Number(groupPriceConfig[0] && groupPriceConfig[0].price_fen) || 0
  })

  mockModule('shared/services/packageGroupStore.js', {
    cleanupExpiredPackageGroups: async () => {}
  })

  mockModule('shared/services/packageSchedule.js', {
    buildPackageLessonSchedule: () => [{ index: 1, class_time: '2026-04-29 09:30:00', display_text: '2026-04-29 09:30:00' }],
    formatPackageDateTime: value => value,
    formatPendingPackageScheduleText: ({ scheduleConfig, classCount }) =>
      `${scheduleConfig.schedule_time}|${(scheduleConfig.schedule_days || []).join(',')}|${classCount}`,
    formatScheduleTextWithLockNote: ({ scheduleConfig, classCount }) =>
      `${scheduleConfig.schedule_time}|${(scheduleConfig.schedule_days || []).join(',')}|${classCount}|lock`
  })

  const { fetchMiniProgramPackageGroupDetail } = require(path.join(backendRoot, 'shared/services/packageReaders.js'))
  const result = await fetchMiniProgramPackageGroupDetail({
    packageGroupId: 'PG-PENDING-0001',
    userId: '',
    now: new Date('2026-04-21T10:00:00.000Z')
  })

  assert.equal(result.schedule_mode, 'pending')
  assert.equal(result.schedule_text, '09:30|2,4|3|lock')
  assert.equal(result.first_class_time, null)
  assert.equal(result.schedule_list.length, 1)
})
