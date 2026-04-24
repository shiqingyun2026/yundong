const { createOkHandler } = require('./_helpers')
const {
  createAdminPackage,
  geocodePackageAddress,
  getAdminPackageDetail,
  listAdminPackageGroups,
  listAdminPackageOrders,
  listAdminPackages,
  offlineAdminPackage,
  refundAdminPackageOrder,
  searchPackageLocations,
  updateAdminPackage
} = require('../services/packageAdminService')

const geocodePackageHandler = createOkHandler('解析坐标失败', req =>
  geocodePackageAddress({
    district: req.body && req.body.district,
    detail: req.body && req.body.detail
  })
)

const searchPackageLocationsHandler = createOkHandler('查询地点失败', req =>
  searchPackageLocations({
    query: req.query || {}
  })
)

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

const offlineAdminPackageHandler = createOkHandler('下架课包失败', req =>
  offlineAdminPackage({
    packageId: req.params.id,
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
  geocodePackageHandler,
  getAdminPackageDetailHandler,
  listAdminPackageGroupsHandler,
  listAdminPackageOrdersHandler,
  listAdminPackagesHandler,
  offlineAdminPackageHandler,
  refundAdminPackageOrderHandler,
  searchPackageLocationsHandler,
  updateAdminPackageHandler
}
