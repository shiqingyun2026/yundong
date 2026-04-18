const express = require('../lib/mini-express')

const { env } = require('../config/env')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { loginMiniProgramUser } = require('../shared/services/miniProgramAuth')
const { resolveWechatIdentityFromHeaders } = require('../shared/utils/wechatIdentity')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

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
