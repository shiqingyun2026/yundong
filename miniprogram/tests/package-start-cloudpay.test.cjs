const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const pagePath = path.resolve(__dirname, '..', 'pages/package/start/index.js')

test('package start page uses cloudpay before falling back to mock payment', () => {
  const source = fs.readFileSync(pagePath, 'utf8')
  const cloudPaymentImportIndex = source.indexOf('prepareCloudPayment')
  const cloudpayBranchIndex = source.indexOf("paymentProvider === 'cloudpay'")
  const mockPaymentIndex = source.indexOf('mockPaymentSuccess({')

  assert.notEqual(cloudPaymentImportIndex, -1)
  assert.notEqual(cloudpayBranchIndex, -1)
  assert.notEqual(mockPaymentIndex, -1)
  assert.equal(cloudpayBranchIndex < mockPaymentIndex, true)
})
