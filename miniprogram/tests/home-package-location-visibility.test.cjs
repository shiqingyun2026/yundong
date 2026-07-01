const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const homeWxmlPath = path.resolve(__dirname, '..', 'pages/home/index.wxml')
const homeJsPath = path.resolve(__dirname, '..', 'pages/home/index.js')

test('home package cards do not render package location text', () => {
  const wxml = fs.readFileSync(homeWxmlPath, 'utf8')
  const js = fs.readFileSync(homeJsPath, 'utf8')

  assert.ok(!wxml.includes('{{item.locationText}}'))
  assert.ok(!wxml.includes('item.distanceText || item.locationDistrict'))
  assert.ok(!js.includes('locationText: item.locationDistrict'))
  assert.ok(!js.includes('locationText: item.locationDisplayText'))
})
