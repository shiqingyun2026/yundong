const createPackageServiceError = (status, code, message) => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

const isPackageServiceError = error => {
  return !!(error && Number.isInteger(error.status) && error.status >= 400 && Number.isInteger(error.code))
}

module.exports = {
  createPackageServiceError,
  isPackageServiceError
}
