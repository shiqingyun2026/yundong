const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')
const startWxmlPath = path.resolve(__dirname, '..', 'pages/package/start/index.wxml')

test('package start page tracks frequency schedule state for multi-session packages', () => {
  const source = fs.readFileSync(startJsPath, 'utf8')

  assert.match(source, /scheduleTypeOptions/)
  assert.match(source, /selectedScheduleType/)
  assert.match(source, /selectedScheduleDays/)
  assert.match(source, /schedulePreviewList/)
})

test('package start page renders frequency choices and weekly multi-select UI', () => {
  const source = fs.readFileSync(startWxmlPath, 'utf8')

  assert.match(source, /课程频率/)
  assert.match(source, /schedule-type-grid/)
  assert.match(source, /weekday-chip-grid/)
  assert.match(source, /课时预览/)
})
