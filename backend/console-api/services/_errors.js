const createConsoleApiError = ({ responseCode = 5000, statusCode = 400, message = '操作失败', extra = {}, code = '' }) => {
  const error = new Error(message)
  error.responseCode = responseCode
  error.statusCode = statusCode
  error.extra = extra

  if (code) {
    error.code = code
  }

  return error
}

const isConsoleApiError = error =>
  !!error && Number.isFinite(error.responseCode) && Number.isFinite(error.statusCode)

module.exports = {
  createConsoleApiError,
  isConsoleApiError
}
