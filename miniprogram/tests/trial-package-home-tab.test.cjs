const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const homeJsPath = path.resolve(__dirname, '..', 'pages/home/index.js')
const detailJsPath = path.resolve(__dirname, '..', 'pages/course/detail/index.js')
const detailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')

test('home page registers a trial package tab and filter branch', () => {
  const source = fs.readFileSync(homeJsPath, 'utf8')

  assert.doesNotMatch(source, /label:\s*'全部课程'/)
  assert.match(
    source,
    /const HOME_TABS = \[\s*\{ key: 'trial', label: '体验课', category: '体验课' \},\s*\{ key: 'fitness', label: '体适能', category: '体适能' \},\s*\{ key: 'jump_rope', label: '跳绳', category: '跳绳' \}\s*\]/
  )
  assert.match(source, /activeTab:\s*'trial'/)
  assert.match(source, /activeTab === 'trial'/)
  assert.match(source, /packageCategory === '体验课'/)
})

test('course detail page has a trial package branch for copy', () => {
  const jsSource = fs.readFileSync(detailJsPath, 'utf8')
  const wxmlSource = fs.readFileSync(detailWxmlPath, 'utf8')

  assert.match(jsSource, /isTrialPackage/)
  assert.match(wxmlSource, /体验课拼团说明|成团后按所选日期与时间上课/)
})
