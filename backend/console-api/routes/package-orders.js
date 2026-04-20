const express = require('../../lib/mini-express')
const {
  listAdminPackageOrdersHandler,
  refundAdminPackageOrderHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageOrdersHandler)
router.post('/:id/refund', refundAdminPackageOrderHandler)

module.exports = router
