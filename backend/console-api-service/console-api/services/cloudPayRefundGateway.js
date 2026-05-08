const cloudbase = require('@cloudbase/node-sdk')
const { env } = require('../../config/env')

let cloudbaseApp = null

const resolveCloudbaseCredentialConfig = () => {
  const secretId = `${process.env.TENCENTCLOUD_SECRETID || ''}`.trim()
  const secretKey = `${process.env.TENCENTCLOUD_SECRETKEY || ''}`.trim()
  const accessKey = `${process.env.CLOUDBASE_APIKEY || ''}`.trim()

  return {
    secretId,
    secretKey,
    accessKey,
    hasSecretPair: !!secretId && !!secretKey,
    hasAccessKey: !!accessKey
  }
}

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then(result => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })

const getCloudbaseApp = () => {
  const credentials = resolveCloudbaseCredentialConfig()
  if (!env.cloudbase.envId) {
    throw new Error('WX_CLOUD_ENV_ID is required for cloudpay refund invocation')
  }

  if (!credentials.hasSecretPair && !credentials.hasAccessKey) {
    throw new Error(
      'CloudBase credentials are missing for console-api-service; set TENCENTCLOUD_SECRETID and TENCENTCLOUD_SECRETKEY, or set CLOUDBASE_APIKEY'
    )
  }

  if (!cloudbaseApp) {
    cloudbaseApp = cloudbase.init({
      env: env.cloudbase.envId,
      timeout: Math.max(1000, Number(env.cloudbase.functionTimeoutMs) || 15000),
      ...(credentials.hasAccessKey ? { accessKey: credentials.accessKey } : {}),
      ...(credentials.hasSecretPair
        ? {
            secretId: credentials.secretId,
            secretKey: credentials.secretKey
          }
        : {})
    })
  }

  return cloudbaseApp
}

const normalizeCloudbaseError = (error, fallbackMessage) => {
  if (!error) {
    return new Error(fallbackMessage)
  }

  const detailParts = [error.message || fallbackMessage]
  if (error.code) {
    detailParts.push(`code=${error.code}`)
  }
  if (error.requestId) {
    detailParts.push(`requestId=${error.requestId}`)
  }
  if (error.original && error.original.message) {
    detailParts.push(`original=${error.original.message}`)
  }

  return new Error(detailParts.join(' | '))
}

const callWechatPayFunction = async ({ data, timeoutMessage }) => {
  const app = getCloudbaseApp()
  const timeoutMs = Math.max(1000, Number(env.cloudbase.functionTimeoutMs) || 15000)

  try {
    return await withTimeout(
      app.callFunction({
        name: env.cloudbase.wechatPayFunctionName,
        data
      }),
      timeoutMs,
      timeoutMessage || `cloud function call timed out after ${timeoutMs}ms`
    )
  } catch (error) {
    throw normalizeCloudbaseError(error, timeoutMessage || 'cloud function call failed')
  }
}

const invokeCloudPayRefund = async ({ orderId, reason, operatorId }) => {
  const result = await callWechatPayFunction({
    data: {
      type: 'refund',
      orderId,
      reason,
      operatorId
    },
    timeoutMessage: 'cloudpay refund invocation timed out'
  })

  const payload = result && (result.result || result)
  if (!payload || payload.code !== 0) {
    throw new Error((payload && payload.message) || 'cloudpay refund failed')
  }

  return payload.data || {}
}

const queryAndSyncCloudPayRefund = async ({ orderId, outRefundNo }) => {
  const result = await callWechatPayFunction({
    data: {
      type: 'queryRefund',
      orderId,
      outRefundNo,
      confirmIfSettled: true
    },
    timeoutMessage: 'cloudpay refund query timed out'
  })

  const payload = result && (result.result || result)
  if (!payload || payload.code !== 0) {
    throw new Error((payload && payload.message) || 'cloudpay refund query failed')
  }

  return payload.data || {}
}

const diagnoseCloudPayFunctionInvocation = async () => {
  const result = await callWechatPayFunction({
    data: {
      type: 'diagnose'
    },
    timeoutMessage: 'cloudpay diagnose invocation timed out'
  })

  const payload = result && (result.result || result)
  if (!payload || payload.code !== 0) {
    throw new Error((payload && payload.message) || 'cloudpay diagnose failed')
  }

  return {
    env_id: env.cloudbase.envId || '',
    function_name: env.cloudbase.wechatPayFunctionName || 'wechat-pay',
    function_timeout_ms: Math.max(1000, Number(env.cloudbase.functionTimeoutMs) || 15000),
    credential_mode: resolveCloudbaseCredentialConfig().hasAccessKey
      ? 'access_key'
      : resolveCloudbaseCredentialConfig().hasSecretPair
        ? 'secret_pair'
        : 'missing',
    cloud_function_result: payload
  }
}

module.exports = {
  diagnoseCloudPayFunctionInvocation,
  invokeCloudPayRefund,
  queryAndSyncCloudPayRefund
}
