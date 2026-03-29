const { createOkHandler } = require('./_helpers')
const { loginAdmin } = require('../services/authService')

const login = createOkHandler('登录失败', req =>
  loginAdmin({
    username: req.body && req.body.username,
    password: req.body && req.body.password,
    ip: req.ip || null
  })
)

module.exports = {
  login
}
