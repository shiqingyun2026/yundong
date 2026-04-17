const resolveWechatIdentityFromHeaders = headers => {
  const source = headers || {}
  const read = key => `${source[key] || source[key.toLowerCase()] || ''}`.trim()

  return {
    openId: read('x-wx-openid'),
    appId: read('x-wx-appid'),
    unionId: read('x-wx-unionid')
  }
}

module.exports = {
  resolveWechatIdentityFromHeaders
}
