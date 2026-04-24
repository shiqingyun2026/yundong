const express = require('../lib/mini-express')

const { env } = require('../config/env')
const authenticate = require('../middleware/auth')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { fetchMiniProgramGroupDetail } = require('../shared/services/groupReaders')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.get('/:id', authenticate, async (req, res) => {
  try {
    logMiniProgramIdentity({
      route: req.path,
      source: req.authSource,
      headers: req.headers,
      userId: req.userId,
      extra: {
        groupId: req.params.id
      }
    })

    return res.json(
      await fetchMiniProgramGroupDetail({
        supabase: resolveSupabase(),
        groupId: req.params.id,
        userId: req.userId
      })
    )
  } catch (error) {
    console.error('[groups/:id] failed to fetch group detail', {
      groupId: req.params.id,
      userId: req.userId,
      error
    })
    return res.status(error.statusCode || 500).json({
      message: error.message || 'failed to fetch group detail'
    })
  }
})

module.exports = router
