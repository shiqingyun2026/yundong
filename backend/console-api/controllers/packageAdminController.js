const { createOkHandler } = require('./_helpers')
const {
  createAdminPackage,
  getAdminPackageDetail,
  listAdminPackageGroups,
  listAdminPackageOrders,
  listAdminPackages,
  refundAdminPackageOrder,
  updateAdminPackage
} = require('../services/packageAdminService')

const listAdminPackagesHandler = createOkHandler('获取课包列表失败', req =>
  listAdminPackages({
    query: req.query || {}
  })
)

const getAdminPackageDetailHandler = createOkHandler('获取课包详情失败', req =>
  getAdminPackageDetail({
    packageId: req.params.id
  })
)

const createAdminPackageHandler = createOkHandler('创建课包失败', req =>
  createAdminPackage({
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const updateAdminPackageHandler = createOkHandler('更新课包失败', req =>
  updateAdminPackage({
    packageId: req.params.id,
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const listAdminPackageGroupsHandler = createOkHandler('获取课包拼团列表失败', req =>
  listAdminPackageGroups({
    query: req.query || {}
  })
)

const listAdminPackageOrdersHandler = createOkHandler('获取课包订单列表失败', req =>
  listAdminPackageOrders({
    query: req.query || {}
  })
)

const refundAdminPackageOrderHandler = createOkHandler('课包订单退款失败', req =>
  refundAdminPackageOrder({
    orderId: req.params.id,
    reason: req.body && req.body.reason,
    admin: req.admin || {},
    ip: req.ip || null
  })
)

module.exports = {
  createAdminPackageHandler,
  getAdminPackageDetailHandler,
  listAdminPackageGroupsHandler,
  listAdminPackageOrdersHandler,
  listAdminPackagesHandler,
  refundAdminPackageOrderHandler,
  updateAdminPackageHandler
}
