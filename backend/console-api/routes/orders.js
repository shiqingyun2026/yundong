const express = require('../../lib/mini-express')
const {
  getOrderDetailHandler,
  listOrdersHandler,
  refundOrderHandler
} = require('../controllers/ordersController')

const router = express.Router()

router.get('/', listOrdersHandler)
router.get('/:id', getOrderDetailHandler)
router.post('/:id/refund', refundOrderHandler)

module.exports = router
