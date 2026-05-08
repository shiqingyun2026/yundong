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
    assert.equal(source.includes('diagnose'), true, `${file} should expose a diagnose entrypoint`)
  })
})

test('wechat pay exposes backend diagnostics for cloudpay prepare failures', () => {
  const source = fs.readFileSync(path.join(root, 'wechat-pay/index.js'), 'utf8')

  assert.equal(source.includes("type === 'diagnoseBackend'"), true, 'wechat-pay should expose diagnoseBackend')
  assert.equal(source.includes("pathname: '/api/payments/internal/cloudpay/prepare'"), true, 'diagnoseBackend should probe prepare route')
  assert.equal(source.includes('prepareProbe'), true, 'diagnoseBackend should return prepare probe status')
  assert.equal(source.includes('backend request failed'), true, 'backend failures should include status/path context')
  assert.equal(source.includes('${pathname}'), true, 'backend failures should include the failing path')
})

test('wechat pay rejects unified order responses without payment params', () => {
  const source = fs.readFileSync(path.join(root, 'wechat-pay/index.js'), 'utf8')

  assert.equal(source.includes('summarizeCloudPayResult'), true, 'wechat-pay should summarize cloudPay failures')
  assert.equal(source.includes('!paymentResult.payment'), true, 'wechat-pay should detect missing payment params')
  assert.equal(source.includes('cloudPay.unifiedOrder failed'), true, 'wechat-pay should return a clear unifiedOrder failure')
  assert.equal(source.includes('cloudPayResult'), true, 'wechat-pay should include sanitized cloudPay diagnostics')
})
