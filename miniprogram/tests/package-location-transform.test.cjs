const test = require('node:test')
const assert = require('node:assert/strict')
const pkg = require('../utils/package')

test('normalizePackageDetail keeps supported locations', () => {
  const detail = pkg.normalizePackageDetail({
    id: 'pkg_test_001',
    name: '体适能',
    locations: [
      {
        id: 'loc_a',
        location_district: '广东省 / 深圳市 / 南山区',
        location_community: '前海花园',
        location_detail: '中心草坪',
        distance_meters: 120
      }
    ],
    active_groups: []
  })

  assert.equal(detail.locations.length, 1)
  assert.equal(detail.locations[0].locationCommunity, '前海花园')
  assert.equal(detail.locations[0].supportedLocationText, '南山区 前海花园')
})

test('normalizePackageDetail formats supported locations as district and venue name', () => {
  const detail = pkg.normalizePackageDetail({
    id: 'pkg_test_001',
    name: '体适能',
    locations: [
      {
        id: 'loc_a',
        location_district: '广东省 / 深圳市 / 坪山区',
        location_community: '聚龙花园'
      },
      {
        id: 'loc_b',
        location_district: '广东省 / 深圳市 / 龙岗区',
        location_community: '大世纪水山缘'
      }
    ],
    active_groups: []
  })

  assert.deepEqual(
    detail.locations.map(item => item.supportedLocationText),
    ['坪山区 聚龙花园', '龙岗区 大世纪水山缘']
  )
})

test('normalizePackageDetail formats active group location as district and venue name', () => {
  const detail = pkg.normalizePackageDetail({
    id: 'pkg_test_001',
    active_groups: [
      {
        id: 'group_001',
        status: 'active',
        target_count: 4,
        current_count: 2,
        remaining_seconds: 3600,
        location_text: '深圳市 / 坪山区 / 聚龙花园'
      }
    ]
  })

  assert.equal(detail.activeGroups[0].locationText, '坪山区 聚龙花园')
})

test('normalizePackageDetail formats active group location from snapshot', () => {
  const detail = pkg.normalizePackageDetail({
    id: 'pkg_test_001',
    active_groups: [
      {
        id: 'group_001',
        status: 'active',
        target_count: 4,
        current_count: 2,
        remaining_seconds: 3600,
        location_snapshot: {
          location_district: '广东省 / 深圳市 / 龙岗区',
          location_community: '大世纪水山缘'
        }
      }
    ]
  })

  assert.equal(detail.activeGroups[0].locationText, '龙岗区 大世纪水山缘')
})

test('createPackageStartOrder passes selected location id', async () => {
  const calls = []
  pkg.__setPackageApiForTest({
    post: async (url, data, options) => {
      calls.push({ url, data, options })
      return { id: 'order_001' }
    }
  })

  try {
    await pkg.createPackageStartOrder({
      packageId: 'pkg_test_001',
      targetCount: 4,
      locationId: 'loc_a',
      childNickname: '小明'
    })
  } finally {
    pkg.__resetPackageApiForTest()
  }

  assert.equal(calls[0].data.locationId, 'loc_a')
})
