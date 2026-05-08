const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const gatewayRoot = path.resolve(__dirname, '..')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(gatewayRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(gatewayRoot, relativePath))
    delete require.cache[modulePath]
  })
}

const loadGateway = ({ createWechatPayRefund, queryWechatPayRefund, fetchImpl }) => {
  process.env.LINDONG_API_BASE_URL = 'https://api.example.com'
  process.env.INTERNAL_PAYMENT_SECRET = 'secret-value'

  clearModules([
    'config/env.js',
    'console-api/services/cloudPayRefundGateway.js',
    'shared/services/wechatMiniProgram.js'
  ])

  mockModule('shared/services/wechatMiniProgram.js', {
    createWechatPayRefund,
    queryWechatPayRefund
  })

  global.fetch = fetchImpl

  return require('../console-api/services/cloudPayRefundGateway.js')
}

const jsonResponse = (payload, { status = 200 } = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })

test('invokeCloudPayRefund prepares order, calls direct wechat refund, and leaves processing refunds pending', async () => {
  const calls = []
  const gateway = loadGateway({
    createWechatPayRefund: async payload => {
      calls.push(['createWechatPayRefund', payload])
      return {
        out_refund_no: payload.outRefundNo,
        status: 'PROCESSING'
      }
    },
    queryWechatPayRefund: async () => {
      throw new Error('queryWechatPayRefund should not be called')
    },
    fetchImpl: async (url, options = {}) => {
      calls.push(['fetch', url, options.method || 'GET'])
      const pathname = new URL(url).pathname
      if (pathname === '/api/payments/internal/cloudpay/refund/prepare') {
        return jsonResponse({
          orderId: 'ord-1',
          outTradeNo: 'LDPKG-1',
          outRefundNo: 'RF-LDPKG-1',
          totalFee: 5000,
          refundFee: 5000,
          refundDesc: '用户退款'
        })
      }

      throw new Error(`unexpected fetch pathname: ${pathname}`)
    }
  })

  const result = await gateway.invokeCloudPayRefund({
    orderId: 'ord-1',
    reason: '用户退款',
    operatorId: 'admin-1'
  })

  assert.equal(result.orderId, 'ord-1')
  assert.equal(result.outRefundNo, 'RF-LDPKG-1')
  assert.equal(result.status, 'refund_pending')
  assert.equal(result.settled, false)
  assert.equal(result.queryStatus, 'PROCESSING')
  assert.deepEqual(calls[0], ['fetch', 'https://api.example.com/api/payments/internal/cloudpay/refund/prepare', 'POST'])
  assert.equal(calls[1][0], 'createWechatPayRefund')
})

test('queryAndSyncCloudPayRefund confirms settled refunds through backend confirm route', async () => {
  const calls = []
  const gateway = loadGateway({
    createWechatPayRefund: async () => {
      throw new Error('createWechatPayRefund should not be called')
    },
    queryWechatPayRefund: async payload => {
      calls.push(['queryWechatPayRefund', payload])
      return {
        out_refund_no: payload.outRefundNo,
        status: 'SUCCESS'
      }
    },
    fetchImpl: async (url, options = {}) => {
      calls.push(['fetch', url, options.method || 'GET'])
      const pathname = new URL(url).pathname
      if (pathname === '/api/payments/internal/cloudpay/refund/confirm') {
        return jsonResponse({
          ok: true
        })
      }

      throw new Error(`unexpected fetch pathname: ${pathname}`)
    }
  })

  const result = await gateway.queryAndSyncCloudPayRefund({
    orderId: 'ord-2',
    outRefundNo: 'RF-LDPKG-2'
  })

  assert.equal(result.finalStatus, 'refunded')
  assert.equal(result.settled, true)
  assert.equal(result.queryStatus, 'SUCCESS')
  assert.deepEqual(calls[0], ['queryWechatPayRefund', { outRefundNo: 'RF-LDPKG-2' }])
  assert.deepEqual(calls[1], ['fetch', 'https://api.example.com/api/payments/internal/cloudpay/refund/confirm', 'POST'])
})
