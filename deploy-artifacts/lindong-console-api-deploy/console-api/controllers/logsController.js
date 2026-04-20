const { createOkHandler } = require('./_helpers')
const { listAdminLogPage } = require('../services/logService')

const listLogs = createOkHandler('获取操作日志失败', req =>
  listAdminLogPage({
    query: req.query || {}
  })
)

module.exports = {
  listLogs
}
