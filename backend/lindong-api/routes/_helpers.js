const ok = (res, data = {}, message = 'ok') =>
  res.json({
    code: 0,
    message,
    data
  })

const fail = (res, code, message, status = 400, extra = {}) =>
  res.status(status).json({
    code,
    message,
    ...extra
  })

module.exports = {
  ok,
  fail
}
