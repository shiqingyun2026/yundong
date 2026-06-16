const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')
const scheduleUtilsPath = path.resolve(__dirname, '..', 'utils/packageSchedule.js')

test('package start page uses classCount-based scheduling instead of package type', () => {
  const source = fs.readFileSync(startJsPath, 'utf8')

  assert.match(source, /classCount/)
  assert.doesNotMatch(source, /isTrialPackage/)
  assert.match(source, /getAllowedScheduleTypeOptions/)
})

test('package schedule utils provide min-date and preview helpers', () => {
  const source = fs.readFileSync(scheduleUtilsPath, 'utf8')
  const { buildMinScheduleDate, buildSchedulePreview } = require(scheduleUtilsPath)

  assert.match(source, /buildMinScheduleDate/)
  assert.match(source, /buildSchedulePreview/)
  assert.match(source, /START_TIME_OPTIONS/)
  assert.equal(buildMinScheduleDate(new Date('2026-06-16T08:00:00+08:00')), '2026-06-19')

  const previewList = buildSchedulePreview({
    classCount: 3,
    scheduleTypeValue: 'weekly:3',
    scheduleDate: '',
    scheduleAnchorDate: '2026-06-17',
    scheduleDays: [1, 3, 5],
    scheduleTime: '09:00'
  })

  assert.equal(previewList.length, 3)
  assert.equal(previewList[0].classTime, '2026-06-17 09:00:00')
  assert.equal(previewList[1].classTime, '2026-06-19 09:00:00')
  assert.equal(previewList[2].classTime, '2026-06-22 09:00:00')
})
