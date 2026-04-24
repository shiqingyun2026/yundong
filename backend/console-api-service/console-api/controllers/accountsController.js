const { createOkHandler } = require('./_helpers')
const {
  createAccount,
  deleteAccountById,
  listAccountPage,
  updateAccountById
} = require('../services/accountService')

const listAccounts = createOkHandler('获取账号列表失败', req =>
  listAccountPage({
    query: req.query || {}
  })
)

const createAccountHandler = createOkHandler('创建账号失败', req =>
  createAccount({
    actorAdmin: req.admin,
    ip: req.ip || null,
    payload: req.body || {}
  })
)

const updateAccountHandler = createOkHandler('更新账号失败', req =>
  updateAccountById({
    accountId: req.params.id,
    actorAdmin: req.admin,
    ip: req.ip || null,
    payload: req.body || {}
  })
)

const deleteAccountHandler = createOkHandler('删除账号失败', req =>
  deleteAccountById({
    accountId: req.params.id,
    actorAdmin: req.admin,
    ip: req.ip || null
  })
)

module.exports = {
  createAccountHandler,
  deleteAccountHandler,
  listAccounts,
  updateAccountHandler
}
