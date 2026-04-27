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

const clone = value => JSON.parse(JSON.stringify(value))

const loadBannerAdminServiceWithStore = initialBanners => {
  const state = {
    banners: clone(initialBanners),
    logs: []
  }

  const targetModules = [
    'console-api/services/bannerAdminService.js',
    'shared/services/bannerState.js',
    'shared/services/bannerStore.js',
    'utils/adminStore.js'
  ].map(relativePath => require.resolve(path.join(backendRoot, relativePath)))

  targetModules.forEach(modulePath => {
    delete require.cache[modulePath]
  })

  mockModule('shared/services/bannerStore.js', {
    readBannerStore: async () => clone(state.banners),
    writeBannerStore: async banners => {
      state.banners = clone(banners)
      return clone(state.banners)
    }
  })

  mockModule('utils/adminStore.js', {
    writeAdminLog: async payload => {
      state.logs.push(clone(payload))
    }
  })

  return {
    bannerAdminService: require(path.join(backendRoot, 'console-api/services/bannerAdminService.js')),
    state
  }
}

test('banner detail returns Shanghai wall-clock time after create', async () => {
  const { bannerAdminService } = loadBannerAdminServiceWithStore([])
  const now = new Date('2026-04-26T01:00:00.000Z')

  const created = await bannerAdminService.createAdminBanner({
    payload: {
      image_url: 'https://example.com/banner.png',
      title: '五一课程 Banner',
      jump_type: 'none',
      jump_target: '',
      sort: 10,
      online_time: '2026-04-27T10:30',
      offline_time: '2026-05-01T22:00'
    },
    admin: { id: 'admin-1', username: 'root', role: 'super_admin' },
    now
  })

  const detail = await bannerAdminService.getAdminBannerDetail({
    bannerId: created.id,
    now
  })

  assert.equal(detail.online_time, '2026-04-27 10:30:00')
  assert.equal(detail.offline_time, '2026-05-01 22:00:00')
})
