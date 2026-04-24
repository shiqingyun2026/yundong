const { env } = require('../../config/env')
const usersRepository = require('../../repositories/usersRepository')
const { resolveUserIdFromAuthorization } = require('./auth')
const { resolveWechatIdentityFromHeaders } = require('./wechatIdentity')

const resolveOptionalMiniProgramUser = async ({ headers = {} } = {}) => {
  const wechatIdentity = resolveWechatIdentityFromHeaders(headers)

  if (env.useMySqlRepositories && wechatIdentity.openId) {
    const user = await usersRepository.findUserByOpenId(wechatIdentity.openId)
    return {
      userId: user && user.id ? user.id : '',
      source: user && user.id ? 'cloudbase' : '',
      wechatIdentity
    }
  }

  const userId = resolveUserIdFromAuthorization(headers.authorization)
  return {
    userId,
    source: userId ? 'bearer' : '',
    wechatIdentity
  }
}

module.exports = {
  resolveOptionalMiniProgramUser
}
