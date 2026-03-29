const ENV_API_BASE_URLS = {
  develop: 'https://lindong-backend.shiqingyun2026.workers.dev',
  trial: 'https://lindong-backend.shiqingyun2026.workers.dev',
  release: 'https://lindong-backend.shiqingyun2026.workers.dev'
}

const ENV_API_TRANSPORTS = {
  develop: 'http',
  trial: 'http',
  release: 'http'
}

const ENV_CLOUD_ENVS = {
  develop: '',
  trial: '',
  release: ''
}

const ENV_CLOUD_FUNCTION_NAMES = {
  develop: 'miniProgramGateway',
  trial: 'miniProgramGateway',
  release: 'miniProgramGateway'
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
const resolveCloudEnvByEnv = envVersion => ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop
const resolveCloudFunctionNameByEnv = envVersion =>
  ENV_CLOUD_FUNCTION_NAMES[envVersion] || ENV_CLOUD_FUNCTION_NAMES.develop

module.exports = {
  ENV_API_BASE_URLS,
  ENV_API_TRANSPORTS,
  ENV_CLOUD_ENVS,
  ENV_CLOUD_FUNCTION_NAMES,
  getMiniProgramEnvVersion,
  resolveBaseURLByEnv,
  resolveApiTransportByEnv,
  resolveCloudEnvByEnv,
  resolveCloudFunctionNameByEnv
}
