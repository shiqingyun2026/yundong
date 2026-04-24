const express = require('../../lib/mini-express')
const {
  createAdminPackageHandler,
  geocodePackageHandler,
  getAdminPackageDetailHandler,
  listAdminPackagesHandler,
  offlineAdminPackageHandler,
  searchPackageLocationsHandler,
  updateAdminPackageHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.post('/geocode', geocodePackageHandler)
router.get('/location-suggestions', searchPackageLocationsHandler)
router.get('/', listAdminPackagesHandler)
router.get('/:id', getAdminPackageDetailHandler)
router.post('/', createAdminPackageHandler)
router.put('/:id', updateAdminPackageHandler)
router.put('/:id/offline', offlineAdminPackageHandler)

module.exports = router
