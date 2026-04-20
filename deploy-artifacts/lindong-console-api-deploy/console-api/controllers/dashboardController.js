const { createOkHandler } = require('./_helpers')
const { getDashboardOverview } = require('../services/dashboardService')

const getOverviewHandler = createOkHandler('获取数据概览失败', req =>
  getDashboardOverview({
    query: req.query || {},
    admin: req.admin || {}
  })
)

module.exports = {
  getOverviewHandler
}
