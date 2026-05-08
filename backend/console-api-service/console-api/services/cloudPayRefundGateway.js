const cloudbase = require('@cloudbase/node-sdk')
const { env } = require('../../config/env')

let cloudbaseApp = null

const getCloudbaseApp = () => {
  if (!cloudbaseApp) {
    cloudbaseApp = cloudbase.init({
      env: env.cloudbase.envId
    })
  }

  return cloudbaseApp
}

const invokeCloudPayRefund = async ({ orderId, reason, operatorId }) => {
  const app = getCloudbaseApp()
  const result = await app.callFunction({
    name: env.cloudbase.wechatPayFunctionName,
    data: {
      type: 'refund',
      orderId,
      reason,
      operatorId
    }
  })

  const payload = result && (result.result || result)
  if (!payload || payload.code !== 0) {
    throw new Error((payload && payload.message) || 'cloudpay refund failed')
  }

  return payload.data || {}
}

module.exports = {
  invokeCloudPayRefund
}
