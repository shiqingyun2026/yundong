const express = require('../../lib/mini-express')
const {
  createAdminPackageHandler,
  getAdminPackageDetailHandler,
  listAdminPackagesHandler,
  updateAdminPackageHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackagesHandler)
router.get('/:id', getAdminPackageDetailHandler)
router.post('/', createAdminPackageHandler)
router.put('/:id', updateAdminPackageHandler)

module.exports = router
