const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const groupDetailWxmlPath = path.resolve(__dirname, '..', 'pages/group/detail/index.wxml')
const paymentConfirmWxmlPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.wxml')
const myGroupListWxmlPath = path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.wxml')

test('member list views use masked student nickname fields', () => {
  const groupDetailSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')
  const paymentConfirmSource = fs.readFileSync(paymentConfirmWxmlPath, 'utf8')
  const myGroupListSource = fs.readFileSync(myGroupListWxmlPath, 'utf8')

  assert.match(groupDetailSource, /\{\{item\.displayText \|\| item\.displayNameMasked \|\| item\.displayName \|\| item\.nickname\}\}/)
  assert.match(paymentConfirmSource, /\{\{item\.displayText \|\| item\.displayNameMasked \|\| item\.displayName \|\| item\.nickname\}\}/)
  assert.match(myGroupListSource, /\{\{item\.childNicknameMasked \|\| item\.childNickname \|\| '未填写'\}\}/)
})
