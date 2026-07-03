const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const detailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')

test('course detail active group shows location but no class time', () => {
  const source = fs.readFileSync(detailWxmlPath, 'utf8')

  assert.match(source, /地点：\{\{item\.locationText \|\| '待确认'\}\}/)
  assert.doesNotMatch(source, /时间：\{\{item\.scheduleText\}\}/)
})
