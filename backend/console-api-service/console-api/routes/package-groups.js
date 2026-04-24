const express = require('../../lib/mini-express')
const { listAdminPackageGroupsHandler } = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageGroupsHandler)

module.exports = router
