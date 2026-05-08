require('dotenv').config()

const express = require('../lib/mini-express')
const { env } = require('../config/env')
const consoleApiRoutes = require('./routes')

const app = express()

const PACKAGE_REFUND_FLOW_VERSION = 'package-refund-flow-2026-05-08-v3'

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
      cloudbase_env_configured: !!env.cloudbase.envId,
      wechat_pay_function_name: env.cloudbase.wechatPayFunctionName || 'wechat-pay',
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
