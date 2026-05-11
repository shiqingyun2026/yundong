const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const groupDetailJsPath = path.resolve(__dirname, '..', 'pages/group/detail/index.js')
const groupDetailWxmlPath = path.resolve(__dirname, '..', 'pages/group/detail/index.wxml')

test('group detail payment success entry shows a dedicated success title for the final joining member', () => {
  const source = fs.readFileSync(groupDetailJsPath, 'utf8')

  assert.match(source, /isPaymentJoinCompletedSuccess\s*=\s*isPaymentSuccessEntry && this\.data\.successType === 'join' && groupDetail\.status === 'success'/)
  assert.match(source, /return '拼团成功，稍后客服将联系您'/)
})

test('group detail payment success entry renders a my-group button for successful final joins', () => {
  const jsSource = fs.readFileSync(groupDetailJsPath, 'utf8')
  const wxmlSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')

  assert.match(jsSource, /successPrimaryActionText:\s*showSuccessPrimaryDetailAction \? '查看我的拼团' : '邀请好友参团'/)
  assert.match(jsSource, /wx\.switchTab\(\{\s*url:\s*'\/pages\/mine\/index'/)
  assert.match(jsSource, /wx\.redirectTo\(\{\s*url:\s*[\s\S]*\/pages\/group\/detail\/index\?packageGroupId=/)
  assert.match(wxmlSource, /wx:if="\{\{showSuccessPrimaryDetailAction\}\}"/)
  assert.match(wxmlSource, /bindtap="handleSuccessPrimaryAction"/)
  assert.match(wxmlSource, /\{\{successPrimaryActionText\}\}/)
})
