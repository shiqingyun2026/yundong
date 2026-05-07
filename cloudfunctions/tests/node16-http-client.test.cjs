const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('wechat pay cloud functions use node16-compatible http client', () => {
  const files = [
    path.join(root, 'wechat-pay/index.js'),
    path.join(root, 'wechat-pay-callback/index.js')
  ]

  files.forEach(file => {
    const source = fs.readFileSync(file, 'utf8')
    assert.equal(source.includes('fetch('), false, `${file} must not use global fetch in Node 16`)
    assert.equal(source.includes("require('node:https')"), true, `${file} should import node:https`)
  })
})
