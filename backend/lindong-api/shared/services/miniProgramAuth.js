const jwt = require('jsonwebtoken')
const { userIdentitiesRepository, usersRepository } = require('../../repositories')
const { exchangeCodeForSession } = require('./wechatMiniProgram')

const resolveMiniProgramOpenId = ({ code, mockOpenId, openId }) => {
  if (openId) {
    return openId
  }

  if (mockOpenId) {
    return mockOpenId
  }

  if (code) {
    return `mock_${code}`
  }

  return ''
}

const shouldUseWechatCodeExchange = ({ mockOpenId, openId }) => !mockOpenId && !openId

const resolveWechatIdentity = async ({ code, mockOpenId, openId, unionId = '', appId = '', sessionKey = '' }) => {
  const resolvedOpenId = `${openId || ''}`.trim()
  const resolvedUnionId = `${unionId || ''}`.trim()
  const resolvedAppId = `${appId || ''}`.trim()

  if (resolvedOpenId) {
    return {
      openId: resolvedOpenId,
      unionId: resolvedUnionId,
      appId: resolvedAppId,
      sessionKey: `${sessionKey || ''}`.trim()
    }
  }

  if (shouldUseWechatCodeExchange({ mockOpenId, openId })) {
    const session = await exchangeCodeForSession(code)
    return {
      openId: session.openId,
      unionId: session.unionId,
      appId: resolvedAppId,
      sessionKey: session.sessionKey
    }
  }

  return {
    openId: resolveMiniProgramOpenId({
      code,
      mockOpenId,
      openId
    }),
    unionId: resolvedUnionId,
    appId: resolvedAppId,
    sessionKey: `${sessionKey || ''}`.trim()
  }
}

const loginMiniProgramUser = async ({ code, mockOpenId, openId, unionId = '', appId = '', sessionKey = '' }) => {
  const wechatIdentity = await resolveWechatIdentity({
    code,
    mockOpenId,
    openId,
    unionId,
    appId,
    sessionKey
  })
  const resolvedOpenId = `${wechatIdentity.openId || ''}`.trim()

  if (!resolvedOpenId) {
    const error = new Error('code is required')
    error.statusCode = 400
    error.code = 400
    throw error
  }

  const identity = await userIdentitiesRepository.findIdentity({
    identityType: 'wechat_openid',
    identityKey: resolvedOpenId
  })
  let user = identity && identity.user_id ? await usersRepository.findUserById(identity.user_id) : null

  if (!user) {
    user = await usersRepository.findUserByOpenId(resolvedOpenId)

    if (user && user.id) {
      await userIdentitiesRepository.assignIdentityToUser({
        userId: user.id,
        identityType: 'wechat_openid',
        identityKey: resolvedOpenId
      })
    }
  }

  if (!user) {
    user = await usersRepository.createUser({
      openid: resolvedOpenId,
      nickname: '微信用户',
      avatarUrl: ''
    })

    await userIdentitiesRepository.assignIdentityToUser({
      userId: user.id,
      identityType: 'wechat_openid',
      identityKey: resolvedOpenId
    })
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  return {
    token,
    userInfo: {
      nickName: user.nickname || '微信用户',
      avatarUrl: user.avatar_url || ''
    }
  }
}

module.exports = {
  loginMiniProgramUser,
  resolveMiniProgramOpenId,
  resolveWechatIdentity
}
