const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

process.env.STORAGE_PROVIDER = 'cos'
process.env.COS_SECRET_ID = 'test-secret-id'
process.env.COS_SECRET_KEY = 'test-secret-key'
process.env.COS_BUCKET = 'demo-1250000000'
process.env.COS_REGION = 'ap-shanghai'

const lindongCosSignedUrl = require(path.resolve(__dirname, '../lindong-api/shared/services/cosSignedUrl'))

test('signCosPublicUrl replaces existing COS auth query instead of appending duplicates', () => {
  const signed = lindongCosSignedUrl.signCosPublicUrl(
    'https://demo-1250000000.cos.ap-shanghai.myqcloud.com/course-cover/banner.png?q-signature=old&q-ak=old&foo=bar'
  )

  assert.equal((signed.match(/q-signature=/g) || []).length, 1)
  assert.equal((signed.match(/q-ak=/g) || []).length, 1)
  assert.match(signed, /foo=bar/)
  assert.doesNotMatch(signed, /q-signature=old/)
})
