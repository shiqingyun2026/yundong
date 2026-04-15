const jwt = require('jsonwebtoken')
const { env } = require('../../config/env')
const usersRepository = require('../../repositories/usersRepository')
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

const resolveWechatIdentity = async ({ code, mockOpenId, openId }) => {
  if (shouldUseWechatCodeExchange({ mockOpenId, openId })) {
    const session = await exchangeCodeForSession(code)
    return {
      openId: session.openId,
      unionId: session.unionId,
      sessionKey: session.sessionKey
    }
  }

  return {
    openId: resolveMiniProgramOpenId({
      code,
      mockOpenId,
      openId
    }),
    unionId: '',
    sessionKey: ''
  }
}

const loginMiniProgramUser = async ({ supabase, code, mockOpenId, openId }) => {
  const wechatIdentity = await resolveWechatIdentity({
    code,
    mockOpenId,
    openId
  })
  const resolvedOpenId = `${wechatIdentity.openId || ''}`.trim()

  if (!resolvedOpenId) {
    const error = new Error('code is required')
    error.statusCode = 400
    error.code = 400
    throw error
  }

  if (env.useMySqlRepositories) {
    let user = await usersRepository.findUserByOpenId(resolvedOpenId)

    if (!user) {
      user = await usersRepository.createUser({
        openid: resolvedOpenId,
        nickname: '微信用户',
        avatarUrl: ''
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

  const { data: existingUser, error: queryError } = await supabase
    .from('users')
    .select('id, nickname, avatar_url')
    .eq('openid', resolvedOpenId)
    .maybeSingle()

  if (queryError) {
    throw queryError
  }

  let user = existingUser

  if (!user) {
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
        openid: resolvedOpenId,
        nickname: '微信用户',
        avatar_url: ''
      })
      .select('id, nickname, avatar_url')
      .single()

    if (insertError) {
      throw insertError
    }

    user = insertedUser
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
