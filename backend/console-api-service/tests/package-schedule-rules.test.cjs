const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..', '..')

const lindongSchedule = require(path.join(root, 'backend/lindong-api/shared/services/packageSchedule.js'))
const consoleSchedule = require(path.join(root, 'backend/console-api-service/shared/services/packageSchedule.js'))

const SERVICE_CASES = [
  ['lindong-api', lindongSchedule],
  ['console-api-service', consoleSchedule]
]

for (const [name, service] of SERVICE_CASES) {
  test(`${name} builds daily schedule with half-hour slots`, () => {
    const scheduleList = service.buildPackageLessonSchedule({
      classCount: 2,
      scheduleType: 'daily',
      startDate: '2026-06-20',
      time: '09:30'
    })

    assert.deepEqual(
      scheduleList.map(item => item.class_time),
      ['2026-06-20 09:30:00', '2026-06-21 09:30:00']
    )
  })

  test(`${name} builds weekly multi-day schedule in chronological order`, () => {
    const scheduleList = service.buildPackageLessonSchedule({
      classCount: 5,
      scheduleType: 'weekly',
      weekdays: [5, 1, 3],
      time: '10:30',
      anchorDate: '2026-06-15'
    })

    assert.deepEqual(
      scheduleList.map(item => item.class_time),
      [
        '2026-06-15 10:30:00',
        '2026-06-17 10:30:00',
        '2026-06-19 10:30:00',
        '2026-06-22 10:30:00',
        '2026-06-24 10:30:00'
      ]
    )
  })
}
