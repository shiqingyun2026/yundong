const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')
const packageUtilsPath = path.resolve(__dirname, '..', 'utils/package.js')

test('package start page submits unified schedule payload for start orders', () => {
  const startSource = fs.readFileSync(startJsPath, 'utf8')
  const utilsSource = fs.readFileSync(packageUtilsPath, 'utf8')

  assert.match(startSource, /scheduleType:\s*schedulePayload\.scheduleType/)
  assert.match(startSource, /scheduleDate:\s*schedulePayload\.scheduleDate/)
  assert.match(startSource, /scheduleDays:\s*schedulePayload\.scheduleDays/)
  assert.match(startSource, /scheduleTime:\s*schedulePayload\.scheduleTime/)
  assert.match(utilsSource, /scheduleType/)
  assert.match(utilsSource, /scheduleDate/)
  assert.match(utilsSource, /scheduleDays/)
  assert.match(utilsSource, /scheduleTime/)
})
