const { post } = require('./request')

// Development-only mock login switch. Keep disabled for production releases.
const USE_MOCK_USER = false
const MOCK_OPEN_ID = 'seed0326_u02'
const GENERATED_USER_INFO_STORAGE_KEY = 'generatedLoginUserInfo'

const buildRandomNickname = () => `用户${Math.floor(1000 + Math.random() * 9000)}`

const getGeneratedUserInfo = () => {
  const existing = wx.getStorageSync(GENERATED_USER_INFO_STORAGE_KEY)

  if (existing && existing.nickName) {
    return existing
  }

  const generatedUserInfo = {
    nickName: buildRandomNickname(),
    avatarUrl: ''
  }

  wx.setStorageSync(GENERATED_USER_INFO_STORAGE_KEY, generatedUserInfo)
  return generatedUserInfo
}

const clearGeneratedUserInfo = () => {
  wx.removeStorageSync(GENERATED_USER_INFO_STORAGE_KEY)
}

const pickUserInfo = (payload, fallbackUserInfo) => {
  const source =
    (payload && (payload.userInfo || payload.user || payload.profile)) ||
    payload ||
    {}

  return {
    nickName:
      source.nickName ||
      source.nickname ||
      source.name ||
      fallbackUserInfo.nickName ||
      '',
    avatarUrl:
      source.avatarUrl ||
      source.avatar ||
      source.avatar_url ||
      fallbackUserInfo.avatarUrl ||
      ''
  }
}

const isReleaseEnv = () => {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion === 'release'
  } catch (error) {
    return false
  }
}

const isMockUserEnabled = () => USE_MOCK_USER && !isReleaseEnv()

const getLoginCode = () => {
  if (isMockUserEnabled()) {
    return Promise.resolve('mock-login-code')
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          resolve(res.code)
          return
        }

        reject(new Error('获取登录凭证失败'))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

const getStableMockOpenId = () => {
  const storageKey = 'mockOpenId'
  const existing = wx.getStorageSync(storageKey)

  if (existing) {
    return existing
  }

  const mockOpenId = `mock_user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  wx.setStorageSync(storageKey, mockOpenId)
  return mockOpenId
}

const getUserProfile = () =>
  new Promise((resolve, reject) => {
    reject(new Error('当前登录方案不采集微信头像昵称'))
  })

const login = async userInfo => {
  const loginCode = await getLoginCode()
  const payload = { code: loginCode }

  if (isMockUserEnabled()) {
    payload.mockOpenId = MOCK_OPEN_ID || getStableMockOpenId()
  }

  const result = await post('/api/auth/login', payload, {
    showLoading: true,
    loadingText: '登录中',
    showErrorToast: false
  })

  if (!result || !result.token) {
    throw new Error('登录接口未返回有效 token')
  }

  return {
    token: result.token,
    userInfo: {
      ...pickUserInfo(result, userInfo || getGeneratedUserInfo()),
      ...getGeneratedUserInfo(),
      avatarUrl: ''
    }
  }
}

const loginWithWechat = async () => login()

module.exports = {
  getUserProfile,
  login,
  loginWithWechat,
  clearGeneratedUserInfo,
  authDebugConfig: {
    USE_MOCK_USER,
    MOCK_OPEN_ID
  }
}
