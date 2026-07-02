const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const detailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')
const overviewWxmlPath = path.resolve(__dirname, '..', 'components/course-overview-sections/index.wxml')

test('supported locations render inside the overview info list after group prices', () => {
  const detailWxml = fs.readFileSync(detailWxmlPath, 'utf8')
  const overviewWxml = fs.readFileSync(overviewWxmlPath, 'utf8')

  assert.ok(!detailWxml.includes('supported-location-card'))
  assert.ok(overviewWxml.includes('支持场地'))
  assert.ok(overviewWxml.indexOf('支持拼团') < overviewWxml.indexOf('支持场地'))
  assert.ok(overviewWxml.includes('{{item.supportedLocationText}}'))
})
