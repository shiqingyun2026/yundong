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
    file: path.resolve(__dirname, '..', 'assets', 'icons', 'course-insurance-banner.jpg'),
    maxBytes: 28000
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
