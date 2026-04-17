const jwt = require('jsonwebtoken')
const { resolveWechatIdentityFromHeaders } = require('../shared/utils/wechatIdentity')
const { env } = require('../config/env')
const usersRepository = require('../repositories/usersRepository')

const authenticate = async (req, res, next) => {
  const wechatIdentity = resolveWechatIdentityFromHeaders(req.headers)

  if (env.useMySqlRepositories && wechatIdentity.openId) {
    try {
      const user = await usersRepository.findUserByOpenId(wechatIdentity.openId)

      if (!user || !user.id) {
        return res.status(401).json({
          message: 'Unauthorized'
        })
      }

      req.userId = user.id
      req.wechatIdentity = wechatIdentity
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
