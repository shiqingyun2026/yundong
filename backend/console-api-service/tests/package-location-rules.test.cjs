const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..', '..')
const lindongReaders = require(path.join(root, 'backend/lindong-api/shared/services/packageReaders.js'))
const consoleReaders = require(path.join(root, 'backend/console-api-service/shared/services/packageReaders.js'))

for (const [name, readers] of [
  ['lindong-api', lindongReaders],
  ['console-api-service', consoleReaders]
]) {
  test(`${name} formats package location snapshot text`, () => {
    assert.equal(
      readers.buildPackageLocationText({
        location_district: '广东省 / 深圳市 / 南山区',
        location_community: '前海花园',
        location_detail: '中心草坪'
      }),
      '深圳市 / 南山区 / 前海花园'
    )
  })

  test(`${name} sorts locations by distance with deadline fallback`, () => {
    const sorted = readers.sortPackageGroupsByLocationDistanceAndDeadline({
      groups: [
        { id: 'late-near', deadline: '2026-07-03 10:00:00', location_snapshot: { latitude: 22.5201, longitude: 113.9001 } },
        { id: 'early-far', deadline: '2026-07-02 10:00:00', location_snapshot: { latitude: 22.9000, longitude: 113.9000 } },
        { id: 'early-near', deadline: '2026-07-02 09:00:00', location_snapshot: { latitude: 22.5201, longitude: 113.9001 } }
      ],
      latitude: 22.5200,
      longitude: 113.9000
    })

    assert.deepEqual(sorted.map(item => item.id), ['early-near', 'late-near', 'early-far'])
  })
}
