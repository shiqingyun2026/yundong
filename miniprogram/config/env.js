const ENV_API_BASE_URLS = {
  develop: 'https://lindongyun.vercel.app',
  trial: 'https://lindongyun.vercel.app',
  release: 'https://lindongyun.vercel.app'
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
