const express = require('../../lib/mini-express')
const { getAdminPackageGroupDetailHandler, listAdminPackageGroupsHandler } = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageGroupsHandler)
router.get('/:id', getAdminPackageGroupDetailHandler)

module.exports = router
