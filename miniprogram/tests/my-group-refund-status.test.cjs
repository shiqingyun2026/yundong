const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('my group list page includes refund tabs and blocks detail navigation for refund states', () => {
  const pageSource = fs.readFileSync(path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.js'), 'utf8')
  const wxmlSource = fs.readFileSync(path.resolve(__dirname, '..', 'pages/my/group-buy-list/index.wxml'), 'utf8')

  assert.equal(pageSource.includes("key: 'refund_pending'"), false)
  assert.equal(pageSource.includes("key: 'refunded'"), false)
  assert.equal(pageSource.includes("key: 'refund_failed'"), false)
  assert.equal(pageSource.includes("key: 'failed'"), true)
  assert.equal(pageSource.includes('item.canOpenDetail'), true)
  assert.equal(wxmlSource.includes('item.displayStatusText'), true)
})
