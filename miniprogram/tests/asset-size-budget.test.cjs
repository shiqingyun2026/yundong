const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const budgets = [
  {
    file: path.resolve(__dirname, '..', 'assets', 'service-wechat-qrcode.jpg'),
    maxBytes: 85000
  },
  {
    file: path.resolve(__dirname, '..', 'assets', 'member-default-avatar.jpg'),
    maxBytes: 30000
  }
]

test('miniprogram bundled images stay within conservative review budgets', () => {
  for (const { file, maxBytes } of budgets) {
    const size = fs.statSync(file).size
    assert.ok(
      size <= maxBytes,
      `${path.relative(path.resolve(__dirname, '..'), file)} is ${size} bytes, expected <= ${maxBytes}`
    )
  }
})

test('miniprogram image and audio assets stay within 200KB total budget', () => {
  const assetFiles = [
    path.resolve(__dirname, '..', 'assets', 'service-wechat-qrcode.jpg'),
    path.resolve(__dirname, '..', 'assets', 'icons', 'course-insurance-banner.png'),
    path.resolve(__dirname, '..', 'assets', 'member-default-avatar.jpg'),
    path.resolve(__dirname, '..', 'assets', 'tabbar', 'home.png'),
    path.resolve(__dirname, '..', 'assets', 'tabbar', 'home-active.png'),
    path.resolve(__dirname, '..', 'assets', 'tabbar', 'mine.png'),
    path.resolve(__dirname, '..', 'assets', 'tabbar', 'mine-active.png')
  ]

  const totalBytes = assetFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0)
  assert.ok(totalBytes <= 200 * 1024, `total image/audio asset size is ${totalBytes} bytes, expected <= 204800`)
})
