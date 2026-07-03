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

test('course detail renders age range as an optional overview info row', () => {
  const overviewWxml = fs.readFileSync(overviewWxmlPath, 'utf8')

  assert.match(overviewWxml, /wx:if="\{\{packageInfo\.ageRange\}\}"/)
  assert.match(overviewWxml, /适用年龄/)
  assert.match(overviewWxml, /\{\{packageInfo\.ageRange\}\}/)
  assert.ok(overviewWxml.indexOf('上课地点') < overviewWxml.indexOf('适用年龄'))
  assert.ok(overviewWxml.indexOf('适用年龄') < overviewWxml.indexOf('支持拼团'))
})
