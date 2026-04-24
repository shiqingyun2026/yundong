const express = require('../../lib/mini-express')
const {
  createAdminBannerHandler,
  getAdminBannerDetailHandler,
  listAdminBannersHandler,
  offlineAdminBannerHandler,
  updateAdminBannerHandler
} = require('../controllers/bannerAdminController')

const router = express.Router()

router.get('/', listAdminBannersHandler)
router.get('/:id', getAdminBannerDetailHandler)
router.post('/', createAdminBannerHandler)
router.post('/:id/offline', offlineAdminBannerHandler)
router.put('/:id', updateAdminBannerHandler)

module.exports = router
