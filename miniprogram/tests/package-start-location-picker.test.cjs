const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startWxmlPath = path.resolve(__dirname, '..', 'pages/package/start/index.wxml')
const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')

test('package start page uses a form row and bottom sheet for location selection', () => {
  const wxml = fs.readFileSync(startWxmlPath, 'utf8')
  const js = fs.readFileSync(startJsPath, 'utf8')

  assert.ok(!wxml.includes('location-select-card'))
  assert.ok(wxml.indexOf('选择拼团人数') < wxml.indexOf('上课地点'))
  assert.ok(wxml.indexOf('上课地点') < wxml.indexOf('上课时间'))
  assert.ok(wxml.includes('bindtap="openLocationPopup"'))
  assert.ok(wxml.includes('selectedLocationDisplayText || \'请选择\''))
  assert.ok(wxml.includes('showLocationPopup'))
  assert.ok(wxml.includes('{{item.supportedLocationText}}'))
  assert.ok(js.includes('selectedLocationDisplayText'))
  assert.ok(js.includes('openLocationPopup'))
})
