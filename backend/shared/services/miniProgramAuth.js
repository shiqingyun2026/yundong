const jwt = require('jsonwebtoken')

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

const loginMiniProgramUser = async ({ supabase, code, mockOpenId, openId }) => {
  const resolvedOpenId = resolveMiniProgramOpenId({
    code,
    mockOpenId,
    openId
  })

  if (!resolvedOpenId) {
    const error = new Error('code is required')
    error.statusCode = 400
    error.code = 400
    throw error
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
  resolveMiniProgramOpenId
}
