const ENV_API_BASE_URLS = {
  develop: 'http://127.0.0.1:8000',
  trial: 'https://api.example.com',
  release: 'https://api.example.com'
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
