const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const detailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')
const startWxmlPath = path.resolve(__dirname, '..', 'pages/package/start/index.wxml')
const overviewWxmlPath = path.resolve(__dirname, '..', 'components/course-overview-sections/index.wxml')

test('package detail hides the legacy single-location overview row', () => {
  const detailWxml = fs.readFileSync(detailWxmlPath, 'utf8')
  const overviewWxml = fs.readFileSync(overviewWxmlPath, 'utf8')

  assert.ok(detailWxml.includes('showLocationInfo="{{false}}"'))
  assert.ok(overviewWxml.includes('showLocationInfo'))
})

test('package start page does not render legacy single-location text above the selector', () => {
  const startWxml = fs.readFileSync(startWxmlPath, 'utf8')

  assert.ok(!startWxml.includes('packageDetail.locationDisplayText || packageDetail.locationText'))
})
