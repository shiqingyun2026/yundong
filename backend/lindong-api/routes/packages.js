const express = require('../lib/mini-express')

const { env } = require('../config/env')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { fetchMiniProgramPackageDetail, fetchMiniProgramPackageList } = require('../shared/services/packageReaders')
const { isPackageServiceError } = require('../shared/services/packageServiceError')
const { ok, fail } = require('./_helpers')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.get('/', async (req, res) => {
  try {
    const data = await fetchMiniProgramPackageList({
      supabase: resolveSupabase(),
      page: req.query.page,
      pageSize: req.query.pageSize,
      keyword: req.query.keyword,
      district: req.query.district,
      category: req.query.category,
      latitude: req.query.latitude,
      longitude: req.query.longitude
    })

    return ok(res, data)
  } catch (error) {
    return fail(res, isPackageServiceError(error) ? error.code : 5000, error.message || 'failed to fetch packages', error.status || 500)
  }
})

router.get('/:id', async (req, res) => {
  try {
    const latitude = Number(req.query.lat ?? req.query.latitude)
    const longitude = Number(req.query.lng ?? req.query.longitude)
    const data = await fetchMiniProgramPackageDetail({
      supabase: resolveSupabase(),
      packageId: req.params.id,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null
    })

    return ok(res, data)
  } catch (error) {
    return fail(res, isPackageServiceError(error) ? error.code : 5000, error.message || 'failed to fetch package detail', error.status || 500)
  }
})

module.exports = router
