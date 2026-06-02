const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')
const startWxmlPath = path.resolve(__dirname, '..', 'pages/package/start/index.wxml')

test('trial package start page adds date-based schedule state', () => {
  const source = fs.readFileSync(startJsPath, 'utf8')

  assert.match(source, /isTrialPackage/)
  assert.match(source, /selectedClassDate/)
  assert.match(source, /minTrialClassDate/)
  assert.match(source, /handleClassDateChange/)
})

test('trial package start page renders date picker and keeps formal-class weekly picker', () => {
  const source = fs.readFileSync(startWxmlPath, 'utf8')

  assert.match(source, /选择上课日期/)
  assert.match(source, /mode="date"/)
  assert.match(source, /最早可选日期为开团后第 2 天/)
  assert.match(source, /wx:if="\{\{isTrialPackage\}\}"/)
  assert.match(source, /wx:else/)
  assert.match(source, /选择每周上课时间/)
})
