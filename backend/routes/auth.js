const express = require('../lib/mini-express')

const { env } = require('../config/env')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { loginMiniProgramUser } = require('../shared/services/miniProgramAuth')
const { resolveWechatIdentityFromHeaders } = require('../shared/utils/wechatIdentity')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.post('/login', async (req, res) => {
  const { code, mockOpenId } = req.body || {}
  const wechatIdentity = resolveWechatIdentityFromHeaders(req.headers)

  if (!code && !mockOpenId && !wechatIdentity.openId) {
    return res.status(400).json({
      message: 'code or x-wx-openid is required'
    })
  }

  try {
    return res.json(
      await loginMiniProgramUser({
        supabase: resolveSupabase(),
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

module.exports = router
