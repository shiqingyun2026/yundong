const express = require('../lib/mini-express')

const { env } = require('../config/env')
const authenticate = require('../middleware/auth')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { fetchMiniProgramPackageGroupDetail } = require('../shared/services/packageReaders')
const { isPackageServiceError } = require('../shared/services/packageServiceError')
const { ok, fail } = require('./_helpers')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await fetchMiniProgramPackageGroupDetail({
      supabase: resolveSupabase(),
      packageGroupId: req.params.id,
      userId: req.userId
    })

    return ok(res, data)
  } catch (error) {
    return fail(res, isPackageServiceError(error) ? error.code : 5000, error.message || 'failed to fetch package group detail', error.status || 500)
  }
})

module.exports = router
