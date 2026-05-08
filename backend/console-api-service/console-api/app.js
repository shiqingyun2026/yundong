require('dotenv').config()

const express = require('../lib/mini-express')
const { env } = require('../config/env')
const consoleApiRoutes = require('./routes')

const app = express()

const PACKAGE_REFUND_FLOW_VERSION = 'package-refund-flow-2026-05-08-v4-direct-refund'

app.use(express.cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-console-api'
  })
})

app.get('/health/package-refund-flow', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-console-api',
    version: PACKAGE_REFUND_FLOW_VERSION,
    packageRefundFlow: {
      expected_initial_order_status: 'refund_pending',
      expected_initial_payment_record_status: 'refund_pending',
      sync_supported_local_statuses: ['success', 'refund_pending', 'refund_failed', 'refunded'],
      refund_transport: 'wechatpay_v3_direct',
      lindong_api_base_url_configured: !!`${env.lindongApiBaseUrl || ''}`.trim(),
      internal_payment_secret_configured: !!`${env.internalPaymentSecret || ''}`.trim(),
      wx_pay_mch_id_configured: !!`${process.env.WX_PAY_MCH_ID || ''}`.trim(),
      wx_pay_mch_serial_no_configured: !!`${process.env.WX_PAY_MCH_SERIAL_NO || ''}`.trim(),
      wx_pay_private_key_configured: !!`${process.env.WX_PAY_PRIVATE_KEY || ''}`.trim(),
      wx_pay_api_v3_key_configured: !!`${process.env.WX_PAY_API_V3_KEY || ''}`.trim(),
      use_mysql_repositories: !!env.useMySqlRepositories
    }
  })
})

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-console-api',
    endpoints: {
      health: '/health',
      packageRefundFlowHealth: '/health/package-refund-flow',
      admin: '/api/admin/*'
    }
  })
})

app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})

app.use('/api/admin', consoleApiRoutes)

module.exports = app
