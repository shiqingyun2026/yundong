const { env } = require('../../config/env')

const CLOUDBASE_IDENTITY_HEADER_KEYS = ['x-wx-openid', 'x-wx-appid', 'x-wx-unionid']

const hasWechatIdentityHeaders = headers => {
  const source = headers || {}
  return CLOUDBASE_IDENTITY_HEADER_KEYS.some(key => !!`${source[key] || source[key.toUpperCase()] || ''}`.trim())
}

const isTrustedCloudBaseMiniProgramRequest = headers => {
  if (!env.trustCloudBaseMiniProgramIdentity) {
    return false
  }

  const source = headers || {}
  return !!`${source['x-wx-service'] || source['X-WX-SERVICE'] || ''}`.trim()
}

const resolveWechatIdentityFromHeaders = headers => {
  const source = headers || {}
  const read = key => `${source[key] || source[key.toLowerCase()] || ''}`.trim()

  if (!isTrustedCloudBaseMiniProgramRequest(source)) {
    return {
      openId: '',
      appId: '',
      unionId: ''
    }
  }

  return {
    openId: read('x-wx-openid'),
    appId: read('x-wx-appid'),
    unionId: read('x-wx-unionid')
  }
}

module.exports = {
  hasWechatIdentityHeaders,
  isTrustedCloudBaseMiniProgramRequest,
  resolveWechatIdentityFromHeaders
}
