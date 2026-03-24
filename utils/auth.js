const { post } = require('./request')

const createMockToken = () => `mock-token-${Date.now()}`

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

const getLoginCode = () =>
  new Promise((resolve, reject) => {
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

const login = async userInfo => {
  const loginCode = await getLoginCode()
  const payload = {
    code: loginCode,
    mockOpenId: getStableMockOpenId()
  }

  try {
    const result = await post('/api/auth/login', payload, {
      showLoading: true,
      loadingText: '登录中',
      showErrorToast: false
    })

    return {
      token: result.token || createMockToken(),
      userInfo: pickUserInfo(result, userInfo)
    }
  } catch (error) {
    return {
      token: createMockToken(),
      userInfo,
      mock: true
    }
  }
}

module.exports = {
  login
}
