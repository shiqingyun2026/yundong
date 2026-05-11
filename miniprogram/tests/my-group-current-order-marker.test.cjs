const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const myGroupListJsPath = path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.js')
const myGroupListWxmlPath = path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.wxml')
const groupDetailJsPath = path.resolve(__dirname, '..', 'pages/group/detail/index.js')
const packageUtilsPath = path.resolve(__dirname, '..', 'utils/package.js')

test('my group list passes order id to the group detail page', () => {
  const jsSource = fs.readFileSync(myGroupListJsPath, 'utf8')
  const wxmlSource = fs.readFileSync(myGroupListWxmlPath, 'utf8')

  assert.match(wxmlSource, /data-order-id="\{\{item\.orderId\}\}"/)
  assert.match(jsSource, /selectedOrderId=\$\{encodeURIComponent\(orderId\)\}/)
})

test('group detail marks the current signup only by selected order id', () => {
  const jsSource = fs.readFileSync(groupDetailJsPath, 'utf8')
  const packageUtilsSource = fs.readFileSync(packageUtilsPath, 'utf8')
  const resolveCurrentOrderChildBlock = jsSource.match(/resolveCurrentOrderChild\(\{[\s\S]*?\n  \},/)

  assert.ok(resolveCurrentOrderChildBlock)

  assert.match(jsSource, /selectedOrderId:\s*decodeURIComponent\(options\.selectedOrderId \|\| ''\)/)
  assert.match(jsSource, /if \(this\.data\.source !== 'myGroupList' \|\| !selectedOrderId\) \{\s*return false\s*\}/)
  assert.match(jsSource, /return `\$\{member\.orderId \|\| member\.order_id \|\| ''\}`\.trim\(\) === selectedOrderId/)
  assert.match(packageUtilsSource, /orderId:\s*member\.order_id \|\| member\.orderId \|\| ''/)
  assert.doesNotMatch(resolveCurrentOrderChildBlock[0], /selectedChildNickname|normalizedSelectedAge|childAge/)
})
