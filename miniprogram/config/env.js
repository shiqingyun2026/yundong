const ENV_API_BASE_URLS = {
  develop: 'https://lindong-backend.shiqingyun2026.workers.dev',
  trial: 'https://lindong-backend.shiqingyun2026.workers.dev',
  release: 'https://lindong-backend.shiqingyun2026.workers.dev'
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

module.exports = {
  ENV_API_BASE_URLS,
  getMiniProgramEnvVersion,
  resolveBaseURLByEnv
}
