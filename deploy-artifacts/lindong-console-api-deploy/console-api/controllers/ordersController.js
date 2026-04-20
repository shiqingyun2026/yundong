const { createOkHandler } = require('./_helpers')
const { getOrderDetail, listOrders, refundOrder } = require('../services/ordersService')

const listOrdersHandler = createOkHandler('获取订单列表失败', req =>
  listOrders({
    query: req.query || {},
    admin: req.admin || {}
  })
)

const getOrderDetailHandler = createOkHandler('获取订单详情失败', req =>
  getOrderDetail({
    orderId: req.params.id,
    admin: req.admin || {}
  })
)

const refundOrderHandler = createOkHandler('手动退款失败', req =>
  refundOrder({
    orderId: req.params.id,
    reason: req.body && req.body.reason,
    admin: req.admin || {},
    ip: req.ip || null
  })
)

module.exports = {
  getOrderDetailHandler,
  listOrdersHandler,
  refundOrderHandler
}
