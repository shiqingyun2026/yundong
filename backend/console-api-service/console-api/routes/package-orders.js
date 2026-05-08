const express = require('../../lib/mini-express')
const {
  listAdminPackageOrdersHandler,
  refundAdminPackageOrderHandler,
  syncAdminPackageOrderRefundStatusHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageOrdersHandler)
router.post('/:id/refund', refundAdminPackageOrderHandler)
router.post('/:id/refund/sync', syncAdminPackageOrderRefundStatusHandler)

module.exports = router
