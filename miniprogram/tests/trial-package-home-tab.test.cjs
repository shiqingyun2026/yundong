const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const homeJsPath = path.resolve(__dirname, '..', 'pages/home/index.js')
const detailJsPath = path.resolve(__dirname, '..', 'pages/course/detail/index.js')
const detailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')

test('home page registers a trial package tab and filter branch', () => {
  const source = fs.readFileSync(homeJsPath, 'utf8')

  assert.match(source, /label:\s*'体验课'/)
  assert.match(source, /activeTab === 'trial'/)
  assert.match(source, /packageCategory === '体验课'/)
})

test('course detail page has a trial package branch for copy', () => {
  const jsSource = fs.readFileSync(detailJsPath, 'utf8')
  const wxmlSource = fs.readFileSync(detailWxmlPath, 'utf8')

  assert.match(jsSource, /isTrialPackage/)
  assert.match(wxmlSource, /体验课拼团说明|成团后按所选日期与时间上课/)
})
