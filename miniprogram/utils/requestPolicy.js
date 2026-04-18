const shouldAttachAuthorization = ({ transport, includeAuthorization }) => {
  if (includeAuthorization !== undefined) {
    return !!includeAuthorization
  }

  return transport !== 'container'
}

const buildRequestHeaders = ({ header = {}, token = '', transport = 'http', includeAuthorization } = {}) => {
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header
  }

  if (token && shouldAttachAuthorization({ transport, includeAuthorization })) {
    requestHeader.Authorization = `Bearer ${token}`
  }

  return requestHeader
}

const buildHttpFallbackHeaders = ({ requestHeader = {}, token = '', includeAuthorization } = {}) => {
  if (!token || includeAuthorization === false) {
    return requestHeader
  }

  return {
    ...requestHeader,
    Authorization: `Bearer ${token}`
  }
}

module.exports = {
  buildHttpFallbackHeaders,
  buildRequestHeaders,
  shouldAttachAuthorization
}
