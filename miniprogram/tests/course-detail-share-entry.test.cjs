const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const courseDetailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')
const courseDetailJsPath = path.resolve(__dirname, '..', 'pages/course/detail/index.js')
const courseDetailHelpersPath = path.resolve(__dirname, '..', 'pages/course/detail/detailHelpers.js')
const shareIconPath = path.resolve(__dirname, '..', 'assets/icons/wechat-share.svg')

test('course detail bottom bar includes a share entry with the wechat icon', () => {
  const source = fs.readFileSync(courseDetailWxmlPath, 'utf8')

  assert.match(source, /open-type="contact"/)
  assert.match(source, /open-type="share"/)
  assert.match(source, /src="\/assets\/icons\/wechat-share\.svg"/)
  assert.match(source, />分享<\/view>/)
})

test('wechat share icon uses the requested green brand color', () => {
  const source = fs.readFileSync(shareIconPath, 'utf8')

  assert.match(source, /#09B83E/)
})

test('course detail share card uses the course cover image', () => {
  const source = fs.readFileSync(courseDetailJsPath, 'utf8')
  const helperSource = fs.readFileSync(courseDetailHelpersPath, 'utf8')

  assert.match(source, /imageUrl:\s*resolveShareImageUrl\(packageDetail && packageDetail\.wechatShareCover\)/)
  assert.doesNotMatch(source, /packageDetail && packageDetail\.cover/)
  assert.match(helperSource, /imageUrl:\s*resolveShareImageUrl\(courseDetail\.cover\)/)
})
