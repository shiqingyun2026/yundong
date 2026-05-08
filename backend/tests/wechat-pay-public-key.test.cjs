const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '../lindong-api')
const servicePath = path.join(backendRoot, 'shared/services/wechatMiniProgram.js')

const loadWechatMiniProgramService = () => {
  delete require.cache[require.resolve(servicePath)]
  return require(servicePath)
}

test('wechat pay callback signature verification supports wechat pay public key', () => {
  const originalEnv = {
    WX_PAY_PLATFORM_CERT: process.env.WX_PAY_PLATFORM_CERT,
    WX_PAY_PUBLIC_KEY: process.env.WX_PAY_PUBLIC_KEY,
    WX_PAY_PUBLIC_KEY_ID: process.env.WX_PAY_PUBLIC_KEY_ID
  }

  try {
    delete process.env.WX_PAY_PLATFORM_CERT
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })
    process.env.WX_PAY_PUBLIC_KEY = publicKey
    process.env.WX_PAY_PUBLIC_KEY_ID = 'PUB_KEY_ID_TEST'

    const timestamp = '1777777777'
    const nonce = 'nonce-for-public-key'
    const rawBody = '{"id":"notify-id"}'
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`
    const signature = crypto.createSign('RSA-SHA256').update(message).end().sign(privateKey, 'base64')
    const { verifyWechatPayCallbackSignature } = loadWechatMiniProgramService()

    assert.equal(
      verifyWechatPayCallbackSignature({
        timestamp,
        nonce,
        signature,
        rawBody,
        serial: 'PUB_KEY_ID_TEST'
      }),
      true
    )
    assert.equal(
      verifyWechatPayCallbackSignature({
        timestamp,
        nonce,
        signature,
        rawBody,
        serial: 'PUB_KEY_ID_OTHER'
      }),
      false
    )
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    delete require.cache[require.resolve(servicePath)]
  }
})
