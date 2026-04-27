const jwt = require('jsonwebtoken')
const { resolveWechatIdentityFromHeaders } = require('../shared/utils/wechatIdentity')
const { env } = require('../config/env')
const { userIdentitiesRepository, usersRepository } = require('../repositories')

const authenticate = async (req, res, next) => {
  const wechatIdentity = resolveWechatIdentityFromHeaders(req.headers)

  if (env.useMySqlRepositories && wechatIdentity.openId) {
    try {
      const identity = await userIdentitiesRepository.findIdentity({
        identityType: 'wechat_openid',
        identityKey: wechatIdentity.openId
      })
      const user = identity && identity.user_id
        ? await usersRepository.findUserById(identity.user_id)
        : await usersRepository.findUserByOpenId(wechatIdentity.openId)

      if (!user || !user.id) {
        return res.status(401).json({
          message: 'Unauthorized'
        })
      }

      if ((!identity || !identity.user_id) && user.id) {
        await userIdentitiesRepository.assignIdentityToUser({
          userId: user.id,
          identityType: 'wechat_openid',
          identityKey: wechatIdentity.openId
        })
      }

      req.userId = user.id
      req.wechatIdentity = wechatIdentity
      req.authSource = 'cloudbase'
      return next()
    } catch (error) {
      return res.status(401).json({
        message: 'Unauthorized'
      })
    }
  }

  const authorization = req.headers.authorization || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      message: 'Unauthorized'
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (!payload || !payload.userId) {
      return res.status(401).json({
        message: 'Unauthorized'
      })
    }

    req.userId = payload.userId
    req.authSource = 'bearer'
    if (wechatIdentity.openId) {
      req.wechatIdentity = wechatIdentity
    }
    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'Unauthorized'
    })
  }
}

module.exports = authenticate
