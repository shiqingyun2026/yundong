const express = require('../lib/mini-express')
const { loginMiniProgramUser } = require('../shared/services/miniProgramAuth')
const { exchangePhoneNumberCode } = require('../shared/services/wechatMiniProgram')
const { mergeUserAccountsByPhone } = require('../shared/services/userAccountMerge')
const { resolveWechatIdentityFromHeaders } = require('../shared/utils/wechatIdentity')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')
const authenticate = require('../middleware/auth')
const { userIdentitiesRepository, usersRepository } = require('../repositories')

const router = express.Router()

router.post('/login', async (req, res) => {
  const { code, mockOpenId } = req.body || {}
  const wechatIdentity = resolveWechatIdentityFromHeaders(req.headers)
  const authSource = wechatIdentity.openId ? 'cloudbase' : code || mockOpenId ? 'bearer' : 'anonymous'

  if (!code && !mockOpenId && !wechatIdentity.openId) {
    logMiniProgramIdentity({
      route: req.path,
      source: 'anonymous',
      headers: req.headers,
      extra: {
        hasCode: !!code,
        hasMockOpenId: !!mockOpenId
      }
    })
    return res.status(400).json({
      message: 'code or x-wx-openid is required'
    })
  }

  try {
    logMiniProgramIdentity({
      route: req.path,
      source: authSource,
      headers: req.headers,
      extra: {
        hasCode: !!code,
        hasMockOpenId: !!mockOpenId
      }
    })

    return res.json(
      await loginMiniProgramUser({
        code,
        mockOpenId,
        openId: wechatIdentity.openId,
        unionId: wechatIdentity.unionId,
        appId: wechatIdentity.appId
      })
    )
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'login failed'
    })
  }
})

router.post('/phone', authenticate, async (req, res) => {
  const { code } = req.body || {}

  if (!code) {
    return res.status(400).json({
      message: 'phone code is required'
    })
  }

  try {
    const phoneInfo = await exchangePhoneNumberCode(code)
    const openId =
      (req.wechatIdentity && req.wechatIdentity.openId) ||
      resolveWechatIdentityFromHeaders(req.headers).openId ||
      ''
    const mergeResult = await mergeUserAccountsByPhone({
      phone: phoneInfo.purePhoneNumber,
      currentUserId: req.userId,
      currentOpenId: openId
    })
    const targetUserId = mergeResult && mergeResult.userId ? mergeResult.userId : req.userId

    if (openId) {
      await userIdentitiesRepository.assignIdentityToUser({
        userId: targetUserId,
        identityType: 'wechat_openid',
        identityKey: openId
      })
    }

    await userIdentitiesRepository.assignIdentityToUser({
      userId: targetUserId,
      identityType: 'phone',
      identityKey: phoneInfo.purePhoneNumber
    })

    const updatedUser = await usersRepository.updateUserPhone({
      id: targetUserId,
      phone: phoneInfo.purePhoneNumber
    })

    return res.json({
      phoneNumber: phoneInfo.phoneNumber,
      purePhoneNumber: phoneInfo.purePhoneNumber,
      countryCode: phoneInfo.countryCode,
      token: require('jsonwebtoken').sign(
        { userId: targetUserId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      ),
      userInfo: {
        nickName: updatedUser && updatedUser.nickname ? updatedUser.nickname : '微信用户',
        avatarUrl: updatedUser && updatedUser.avatar_url ? updatedUser.avatar_url : '',
        phone: updatedUser && updatedUser.phone ? updatedUser.phone : phoneInfo.purePhoneNumber
      }
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'bind phone failed'
    })
  }
})

module.exports = router
