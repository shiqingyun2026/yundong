const express = require('../lib/mini-express')

const { ok, fail } = require('./_helpers')
const { fetchMiniProgramHomeBanners } = require('../shared/services/bannerReaders')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const data = await fetchMiniProgramHomeBanners({
      city: req.query.city
    })

    return ok(res, data)
  } catch (error) {
    return fail(res, 5000, error.message || 'failed to fetch banners', error.status || 500)
  }
})

module.exports = router
