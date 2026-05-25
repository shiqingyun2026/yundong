const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const paymentConfirmWxmlPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.wxml')
const paymentConfirmJsPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.js')
const paymentConfirmWxssPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.wxss')
const paymentConfirmJsonPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.json')
const groupDetailJsPath = path.resolve(__dirname, '..', 'pages/group/detail/index.js')
const packageUtilsPath = path.resolve(__dirname, '..', 'utils/package.js')

test('join payment page bottom bar includes a share entry with the wechat icon', () => {
  const source = fs.readFileSync(paymentConfirmWxmlPath, 'utf8')

  assert.match(source, /wx:if="\{\{!loading && packageDetail\}\}" class="payment-bar"/)
  assert.match(source, /wx:if="\{\{action === 'join' && packageGroupDetail\}\}"/)
  assert.match(source, /open-type="share"/)
  assert.match(source, /src="\/assets\/icons\/wechat-share\.svg"/)
  assert.match(source, />分享<\/view>/)
})

test('join payment page registers a share handler to the current group detail page', () => {
  const source = fs.readFileSync(paymentConfirmJsPath, 'utf8')

  assert.match(source, /onShareAppMessage\(\)/)
  assert.match(source, /\/pages\/group\/detail\/index\?packageGroupId=/)
  assert.match(source, /entry=share&action=join/)
  assert.match(source, /imageUrl:\s*resolveShareImageUrl\(packageDetail && packageDetail\.wechatShareCover\)/)
  assert.doesNotMatch(source, /packageDetail && packageDetail\.cover/)
})

test('join payment page enables share and shortens the pay button layout', () => {
  const jsonSource = fs.readFileSync(paymentConfirmJsonPath, 'utf8')
  const styleSource = fs.readFileSync(paymentConfirmWxssPath, 'utf8')

  assert.match(jsonSource, /"enableShareAppMessage":\s*true/)
  assert.match(styleSource, /\.payment-action\s*\{/)
  assert.match(styleSource, /\.service-entry\s*\{/)
})

test('group detail share card uses the wechat share cover image', () => {
  const groupDetailSource = fs.readFileSync(groupDetailJsPath, 'utf8')
  const packageUtilsSource = fs.readFileSync(packageUtilsPath, 'utf8')

  assert.match(groupDetailSource, /imageUrl:\s*resolveShareImageUrl\(groupDetail\.packageInfo\.wechatShareCover\)/)
  assert.match(
    packageUtilsSource,
    /wechatShareCover:\s*payload\.package && payload\.package\.wechat_share_cover \? payload\.package\.wechat_share_cover : ''/
  )
})
