const { env } = require('../../config/env')
const { userIdentitiesRepository, usersRepository } = require('../../repositories')
const { resolveUserIdFromAuthorization } = require('./auth')
const { resolveWechatIdentityFromHeaders } = require('./wechatIdentity')

const resolveOptionalMiniProgramUser = async ({ headers = {} } = {}) => {
  const wechatIdentity = resolveWechatIdentityFromHeaders(headers)

  if (wechatIdentity.openId) {
    const identity = await userIdentitiesRepository.findIdentity({
      identityType: 'wechat_openid',
      identityKey: wechatIdentity.openId
    })
    const user = identity && identity.user_id
      ? await usersRepository.findUserById(identity.user_id)
      : await usersRepository.findUserByOpenId(wechatIdentity.openId)

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
