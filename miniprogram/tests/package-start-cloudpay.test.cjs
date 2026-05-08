const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const pagePaths = [
  path.resolve(__dirname, '..', 'pages/package/start/index.js'),
  path.resolve(__dirname, '..', 'pages/payment/confirm/index.js')
]
const envPath = path.resolve(__dirname, '..', 'config/env.js')

test('package payment pages use direct wechat payment instead of cloudpay', () => {
  for (const pagePath of pagePaths) {
    const source = fs.readFileSync(pagePath, 'utf8')
    const cloudPaymentImportIndex = source.indexOf('prepareCloudPayment')
    const cloudpayBranchIndex = source.indexOf("paymentProvider === 'cloudpay'")
    const preparePaymentIndex = source.indexOf('preparePayment({')
    const mockPaymentIndex = source.indexOf('mockPaymentSuccess({')

    assert.equal(cloudPaymentImportIndex, -1, pagePath)
    assert.equal(cloudpayBranchIndex, -1, pagePath)
    assert.notEqual(preparePaymentIndex, -1, pagePath)
    assert.notEqual(mockPaymentIndex, -1, pagePath)
    assert.equal(preparePaymentIndex < mockPaymentIndex, true, pagePath)
  }
})

test('mini program environments default to direct wechat payment', () => {
  const source = fs.readFileSync(envPath, 'utf8')

  assert.match(source, /develop:\s*'wechat'/)
  assert.match(source, /trial:\s*'wechat'/)
  assert.match(source, /release:\s*'wechat'/)
  assert.doesNotMatch(source, /develop:\s*'cloudpay'/)
  assert.doesNotMatch(source, /trial:\s*'cloudpay'/)
  assert.doesNotMatch(source, /release:\s*'cloudpay'/)
})
