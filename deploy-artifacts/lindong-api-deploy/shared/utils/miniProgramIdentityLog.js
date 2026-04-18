const { env } = require('../../config/env')
const { hasWechatIdentityHeaders } = require('./wechatIdentity')

const shouldLogMiniProgramIdentity = () => !!env.enableMiniProgramIdentityLogs

const logMiniProgramIdentity = ({ route, source = '', headers = {}, userId = '', extra = {} } = {}) => {
  if (!shouldLogMiniProgramIdentity()) {
    return
  }

  console.info('[miniprogram-auth]', {
    route: route || '',
    source: source || 'anonymous',
    userIdPresent: !!userId,
    hasAuthorization: !!`${(headers && headers.authorization) || ''}`.trim(),
    hasWechatIdentityHeaders: hasWechatIdentityHeaders(headers),
    ...extra
  })
}

module.exports = {
  logMiniProgramIdentity,
  shouldLogMiniProgramIdentity
}
