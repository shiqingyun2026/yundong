const DEFAULT_ERROR_MESSAGE = '网络开小差了，请稍后再试'
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const { callContainerApi, resolveCloudContainerRuntime } = require('./callContainerApi')
const { buildHttpFallbackHeaders, buildRequestHeaders, shouldAttachAuthorization } = require('./requestPolicy')

const getRuntimeApp = () => {
  try {
    return getApp()
  } catch (error) {
    return null
  }
}

const resolveBaseURL = () => {
  const app = getRuntimeApp()

  if (app && app.globalData && app.globalData.baseURL) {
    return app.globalData.baseURL
  }

  return DEFAULT_BASE_URL
}

const resolveApiTransport = () => {
  const app = getRuntimeApp()

  if (app && app.globalData && app.globalData.apiTransport) {
    return app.globalData.apiTransport
  }

  return 'http'
}

const resolveEnvVersion = () => {
  const app = getRuntimeApp()

  if (app && app.globalData && app.globalData.envVersion) {
    return app.globalData.envVersion
  }

  return 'develop'
}

const showToast = message => {
  wx.showToast({
    title: message || DEFAULT_ERROR_MESSAGE,
    icon: 'none'
  })
}

const normalizeBusinessPayload = data => {
  if (!data || typeof data !== 'object') {
    return data
  }

  if (Object.prototype.hasOwnProperty.call(data, 'code')) {
    const isBusinessSuccess = data.code === 0 || data.code === 200

    if (!isBusinessSuccess) {
      throw {
        message: data.message || DEFAULT_ERROR_MESSAGE,
        code: data.code,
        data
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'data')) {
      return data.data
    }
  }

  return data
}

const normalizeHttpResponse = response => {
  const { statusCode, data } = response
  const successStatus = statusCode >= 200 && statusCode < 300

  if (!successStatus) {
    throw {
      message: data && data.message ? data.message : DEFAULT_ERROR_MESSAGE,
      statusCode,
      data
    }
  }

  return normalizeBusinessPayload(data)
}

const normalizeContainerResponse = response => {
  const payload =
    response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'data')
      ? response.data
      : response
  const statusCode =
    response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'statusCode')
      ? response.statusCode
      : 200

  return normalizeHttpResponse({
    statusCode,
    data: payload
  })
}

const resetToken = () => {
  wx.removeStorageSync('token')

  const app = getRuntimeApp()
  if (app && app.globalData) {
    app.globalData.token = ''
  }
}

const handleRequestError = (error, showErrorToast) => {
  if (error && (error.statusCode === 401 || error.code === 401)) {
    resetToken()
  }

  if (showErrorToast) {
    showToast(error && error.message ? error.message : DEFAULT_ERROR_MESSAGE)
  }
}

const shouldRetryContainerWithHttp = () => false

const httpRequest = ({ url, method, data, header, token }) =>
  new Promise((resolve, reject) => {
    const requestURL = `${resolveBaseURL()}${url}`

    console.log('[request:http] start', {
      url: requestURL,
      method,
      data,
      hasToken: !!token,
      tokenPreview: token ? `${token}`.slice(0, 16) : ''
    })

    wx.request({
      url: requestURL,
      method,
      data,
      header,
      success(response) {
        console.log('[request:http] success', {
          url: requestURL,
          statusCode: response.statusCode,
          data: response.data
        })

        try {
          resolve(normalizeHttpResponse(response))
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        console.log('[request:http] fail', {
          url: requestURL,
          error
        })
        reject(error)
      }
    })
  })

const containerRequest = ({ url, method, data, header }) =>
  new Promise((resolve, reject) => {
    const runtime = resolveCloudContainerRuntime()

    console.log('[request:container] start', {
      serviceName: runtime.serviceName,
      resourceEnv: runtime.resourceEnv,
      path: url,
      method,
      data
    })

    callContainerApi({
      path: url,
      method,
      header,
      data,
    })
      .then(response => {
        console.log('[request:container] success', {
          serviceName: runtime.serviceName,
          path: url,
          statusCode: response && response.statusCode,
          data: response && response.data
        })

        try {
          resolve(normalizeContainerResponse(response))
        } catch (error) {
          reject(error)
        }
      })
      .catch(error => {
        console.log('[request:container] fail', {
          serviceName: runtime.serviceName,
          path: url,
          error
        })
        reject(error)
      })
  })

const request = options => {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    showLoading = false,
    loadingText = '加载中',
    showErrorToast = true,
    includeAuthorization
  } = options

  if (!url) {
    return Promise.reject(new Error('request url is required'))
  }

  if (showLoading) {
    wx.showLoading({
      title: loadingText,
      mask: true
    })
  }

  const transport = resolveApiTransport()
  const envVersion = resolveEnvVersion()
  const token = wx.getStorageSync('token')
  const attachAuthorization = shouldAttachAuthorization({ transport, includeAuthorization })
  const requestHeader = buildRequestHeaders({
    header,
    token,
    transport,
    includeAuthorization
  })

  const requestPayload = {
    url,
    method,
    data,
    header: requestHeader,
    token
  }
  const httpFallbackPayload =
    token && includeAuthorization !== false
      ? {
          ...requestPayload,
          header: buildHttpFallbackHeaders({
            requestHeader,
            token,
            includeAuthorization
          })
        }
      : requestPayload

  const transportRequest = transport === 'container' ? containerRequest : httpRequest

  return transportRequest(requestPayload)
    .catch(error => {
      if (transport === 'container' && envVersion === 'develop' && shouldRetryContainerWithHttp(error)) {
        console.warn('[request] container request failed in develop, retrying with http', {
          url,
          method,
          attachAuthorization,
          error
        })

        return httpRequest(httpFallbackPayload)
      }

      handleRequestError(error, showErrorToast)
      return Promise.reject(error)
    })
    .catch(error => {
      handleRequestError(error, showErrorToast)
      return Promise.reject(error)
    })
    .finally(() => {
      if (showLoading) {
        wx.hideLoading()
      }
    })
}

const get = (url, data, options = {}) => request({ url, data, method: 'GET', ...options })
const post = (url, data, options = {}) => request({ url, data, method: 'POST', ...options })
const put = (url, data, options = {}) => request({ url, data, method: 'PUT', ...options })
const del = (url, data, options = {}) => request({ url, data, method: 'DELETE', ...options })

module.exports = {
  request,
  get,
  post,
  put,
  del
}
