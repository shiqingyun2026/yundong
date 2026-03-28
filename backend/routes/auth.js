const express = require('../lib/mini-express')
const jwt = require('jsonwebtoken')

const supabase = require('../utils/supabase')

const router = express.Router()

router.post('/login', async (req, res) => {
  const { code, mockOpenId } = req.body || {}

  if (!code) {
    return res.status(400).json({
      message: 'code is required'
    })
  }

  const openid = mockOpenId || `mock_${code}`

  try {
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('id, nickname, avatar_url')
      .eq('openid', openid)
      .maybeSingle()

    if (queryError) {
      throw queryError
    }

    let user = existingUser

    if (!user) {
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({
          openid,
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

    return res.json({
      token,
      userInfo: {
        nickName: user.nickname || '微信用户',
        avatarUrl: user.avatar_url || ''
      }
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'login failed'
    })
  }
})

module.exports = router
