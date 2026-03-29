const { createOkHandler } = require('./_helpers')
const { getGroupDetail, listGroupOrders, listGroups } = require('../services/groupsService')

const listGroupsHandler = createOkHandler('获取拼团列表失败', req =>
  listGroups({
    query: req.query || {}
  })
)

const listGroupOrdersHandler = createOkHandler('获取拼团关联订单失败', req =>
  listGroupOrders({
    groupId: req.params.id
  })
)

const getGroupDetailHandler = createOkHandler('获取拼团详情失败', req =>
  getGroupDetail({
    groupId: req.params.id
  })
)

module.exports = {
  getGroupDetailHandler,
  listGroupOrdersHandler,
  listGroupsHandler
}
