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

  assert.match(source, /buildMinScheduleDate/)
  assert.match(source, /buildSchedulePreview/)
  assert.match(source, /START_TIME_OPTIONS/)
})
