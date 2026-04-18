const CLOUD_CONTAINER_SERVICE_MISSING_MESSAGE = '请先配置云托管服务名'
let cloudContainerRuntime = null

const getRuntimeApp = () => {
  try {
    return getApp()
  } catch (error) {
    return null
  }
}

const ensureCloudRuntimeReady = async () => {
  const app = getRuntimeApp()

  if (!app || typeof app.ensureCloudReady !== 'function') {
    return false
  }

  return app.ensureCloudReady()
}

const getCloudContainerClient = async resourceEnv => {
  if (cloudContainerRuntime && cloudContainerRuntime.resourceEnv === resourceEnv) {
    return cloudContainerRuntime.client
  }

  const client = new wx.cloud.Cloud(
    resourceEnv
      ? {
          resourceEnv
        }
      : {}
  )

  await client.init()
  cloudContainerRuntime = {
    resourceEnv,
    client
  }

  return client
}

const resolveCloudContainerRuntime = () => {
  const app = getRuntimeApp()
  const globalData = (app && app.globalData) || {}

  return {
    cloudReady: !!globalData.cloudReady,
    resourceEnv: globalData.cloudEnv || '',
    serviceName: globalData.cloudContainerServiceName || ''
  }
}

const assertCloudContainerReady = ({ cloudReady, serviceName }) => {
  if (!wx.cloud || typeof wx.cloud.Cloud !== 'function') {
    throw new Error('当前基础库不支持云托管调用')
  }

  if (!cloudReady) {
    throw new Error('云开发尚未初始化，请先完成云环境配置')
  }

  if (!serviceName) {
    throw new Error(CLOUD_CONTAINER_SERVICE_MISSING_MESSAGE)
  }
}

const callContainerApi = ({ path, method = 'GET', data, header = {} }) =>
  new Promise((resolve, reject) => {
    ensureCloudRuntimeReady()
      .then(() => {
        const runtime = resolveCloudContainerRuntime()

        try {
          assertCloudContainerReady(runtime)
        } catch (error) {
          reject(error)
          return
        }

        getCloudContainerClient(runtime.resourceEnv)
          .then(client => {
            client.callContainer({
              path,
              method,
              header: {
                ...header,
                'X-WX-SERVICE': runtime.serviceName
              },
              data,
              success: resolve,
              fail: reject
            })
          })
          .catch(reject)
      })
      .catch(reject)
  })

module.exports = {
  callContainerApi,
  resolveCloudContainerRuntime
}
