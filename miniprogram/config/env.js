const ENV_API_BASE_URLS = {
  develop: 'https://lindong-backend.shiqingyun2026.workers.dev',
  trial: 'https://lindong-backend.shiqingyun2026.workers.dev',
  release: 'https://lindong-backend.shiqingyun2026.workers.dev'
}

const ENV_API_TRANSPORTS = {
  develop: 'container',
  trial: 'http',
  release: 'http'
}

const CLOUD_ENV_PLACEHOLDER = 'TODO_WECHAT_CLOUD_ENV'
const CLOUD_CONTAINER_SERVICE_PLACEHOLDER = 'TODO_CLOUD_RUN_SERVICE'

const ENV_CLOUD_ENVS = {
  develop: 'cloud1-4glzoev0baf7b187',
  trial: CLOUD_ENV_PLACEHOLDER,
  release: CLOUD_ENV_PLACEHOLDER
}

const ENV_CLOUD_CONTAINER_SERVICE_NAMES = {
  develop: 'lindong-api',
  trial: CLOUD_CONTAINER_SERVICE_PLACEHOLDER,
  release: CLOUD_CONTAINER_SERVICE_PLACEHOLDER
}

const getMiniProgramEnvVersion = () => {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || 'develop'
  } catch (error) {
    return 'develop'
  }
}

const resolveBaseURLByEnv = envVersion => ENV_API_BASE_URLS[envVersion] || ENV_API_BASE_URLS.develop
const resolveApiTransportByEnv = envVersion => ENV_API_TRANSPORTS[envVersion] || ENV_API_TRANSPORTS.develop
const resolveCloudEnvByEnv = envVersion => {
  const value = ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop
  return value === CLOUD_ENV_PLACEHOLDER ? '' : value
}
const resolveCloudContainerServiceNameByEnv = envVersion => {
  const value =
    ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop
  return value === CLOUD_CONTAINER_SERVICE_PLACEHOLDER ? '' : value
}
const isCloudEnvConfigured = envVersion =>
  !!(ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop) &&
  (ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop) !== CLOUD_ENV_PLACEHOLDER
const isCloudContainerServiceConfigured = envVersion =>
  !!(ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop) &&
  (ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop) !==
    CLOUD_CONTAINER_SERVICE_PLACEHOLDER

module.exports = {
  ENV_API_BASE_URLS,
  ENV_API_TRANSPORTS,
  CLOUD_ENV_PLACEHOLDER,
  CLOUD_CONTAINER_SERVICE_PLACEHOLDER,
  ENV_CLOUD_ENVS,
  ENV_CLOUD_CONTAINER_SERVICE_NAMES,
  getMiniProgramEnvVersion,
  resolveBaseURLByEnv,
  resolveApiTransportByEnv,
  resolveCloudEnvByEnv,
  resolveCloudContainerServiceNameByEnv,
  isCloudEnvConfigured,
  isCloudContainerServiceConfigured
}
