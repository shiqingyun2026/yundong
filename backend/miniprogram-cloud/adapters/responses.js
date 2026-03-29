const DEFAULT_ERROR_MESSAGE = '云函数调用失败，请稍后再试'

const ok = data => ({
  code: 0,
  data
})

const fail = error => {
  const statusCode = Number(error && error.statusCode) || 500
  const numericCode = Number(error && error.code)
  const code = Number.isFinite(numericCode) && numericCode > 0 ? numericCode : statusCode

  return {
    code,
    message: (error && error.message) || DEFAULT_ERROR_MESSAGE,
    errorCode:
      error && typeof error.code === 'string' && error.code
        ? error.code
        : statusCode === 404
          ? 'MINIPROGRAM_CLOUD_ROUTE_NOT_FOUND'
          : 'MINIPROGRAM_CLOUD_REQUEST_FAILED'
  }
}

module.exports = {
  ok,
  fail
}
