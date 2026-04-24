const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

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

const loadBannerStateWithStore = initialBanners => {
  const state = {
    banners: JSON.parse(JSON.stringify(initialBanners)),
    writes: []
  }

  const targetModules = ['shared/services/bannerState.js', 'shared/services/bannerStore.js'].map(relativePath =>
    require.resolve(path.join(backendRoot, relativePath))
  )

  targetModules.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('shared/services/bannerStore.js', {
    readBannerStore: async () => JSON.parse(JSON.stringify(state.banners)),
    writeBannerStore: async banners => {
      state.writes.push(JSON.parse(JSON.stringify(banners)))
      state.banners = JSON.parse(JSON.stringify(banners))
      return JSON.parse(JSON.stringify(banners))
    }
  })

  return {
    bannerState: require(path.join(backendRoot, 'shared/services/bannerState.js')),
    state
  }
}

test('banner state sync auto-updates status and writes normalized state back', async () => {
  const now = new Date('2026-04-25T00:00:00.000Z')
  const { bannerState, state } = loadBannerStateWithStore([
    {
      id: 'banner-pending-to-active',
      image_url: 'https://example.com/a.png',
      title: '待上线 Banner',
      jump_type: 'none',
      jump_target: '',
      sort: 10,
      online_time: '2026-04-24T00:00:00.000Z',
      offline_time: '2026-04-26T00:00:00.000Z',
      status: 'pending',
      created_at: '2026-04-23T00:00:00.000Z',
      updated_at: '2026-04-23T00:00:00.000Z'
    },
    {
      id: 'banner-active-to-inactive',
      image_url: 'https://example.com/b.png',
      title: '已上线 Banner',
      jump_type: 'none',
      jump_target: '',
      sort: 20,
      online_time: '2026-04-20T00:00:00.000Z',
      offline_time: '2026-04-22T00:00:00.000Z',
      status: 'active',
      created_at: '2026-04-20T00:00:00.000Z',
      updated_at: '2026-04-20T00:00:00.000Z'
    }
  ])

  const synced = await bannerState.syncBannerStoreStatus({ now })
  const pendingToActive = synced.find(item => item.id === 'banner-pending-to-active')
  const activeToInactive = synced.find(item => item.id === 'banner-active-to-inactive')

  assert.equal(pendingToActive.status, 'active')
  assert.equal(activeToInactive.status, 'inactive')
  assert.equal(state.writes.length, 1)
  assert.equal(state.writes[0].find(item => item.id === 'banner-pending-to-active').updated_at, now.toISOString())
  assert.equal(state.writes[0].find(item => item.id === 'banner-active-to-inactive').updated_at, now.toISOString())
})

test('banner state sync skips write when persisted statuses are already current', async () => {
  const now = new Date('2026-04-25T00:00:00.000Z')
  const { bannerState, state } = loadBannerStateWithStore([
    {
      id: 'banner-active',
      image_url: 'https://example.com/a.png',
      title: '已上线 Banner',
      jump_type: 'none',
      jump_target: '',
      sort: 10,
      online_time: '2026-04-24T00:00:00.000Z',
      offline_time: '2026-04-26T00:00:00.000Z',
      status: 'active',
      created_at: '2026-04-23T00:00:00.000Z',
      updated_at: '2026-04-23T00:00:00.000Z'
    }
  ])

  const synced = await bannerState.syncBannerStoreStatus({ now })

  assert.equal(synced[0].status, 'active')
  assert.equal(state.writes.length, 0)
})
