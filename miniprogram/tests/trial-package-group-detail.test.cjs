const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const groupDetailWxmlPath = path.resolve(__dirname, '..', 'pages/group/detail/index.wxml')

test('group detail page has a single-session branch for single-class packages', () => {
  const source = fs.readFileSync(groupDetailWxmlPath, 'utf8')

  assert.match(source, /single_session/)
  assert.match(source, /section-title">课时安排/)
  assert.match(source, /single_session' \? '上课时间'/)
})
