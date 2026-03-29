const DEFAULT_ERROR_MESSAGE = '网络开小差了，请稍后再试'
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const DEFAULT_CLOUD_FUNCTION_NAME = 'miniProgramGateway'

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

const resolveCloudFunctionName = () => {
  const app = getRuntimeApp()

  if (app && app.globalData && app.globalData.cloudFunctionName) {
    return app.globalData.cloudFunctionName
  }

  return DEFAULT_CLOUD_FUNCTION_NAME
}

const isCloudReady = () => {
  const app = getRuntimeApp()
  return !!(app && app.globalData && app.globalData.cloudReady)
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

const normalizeCloudResponse = response => {
  const payload =
    response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'result')
      ? response.result
      : response

  if (payload && payload.errorMessage && !Object.prototype.hasOwnProperty.call(payload, 'code')) {
    throw {
      message: payload.errorMessage || DEFAULT_ERROR_MESSAGE,
      data: payload
    }
  }

  return normalizeBusinessPayload(payload)
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

const cloudRequest = ({ url, method, data, header, token }) =>
  new Promise((resolve, reject) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject(new Error('当前基础库不支持云开发调用'))
      return
    }

    if (!isCloudReady()) {
      reject(new Error('云开发尚未初始化，请先完成云环境配置'))
      return
    }

    const functionName = resolveCloudFunctionName()

    console.log('[request:cloud] start', {
      functionName,
      path: url,
      method,
      data,
      hasToken: !!token
    })

    wx.cloud.callFunction({
      name: functionName,
      data: {
        path: url,
        method,
        data,
        header,
        authToken: token
      },
      success(response) {
        console.log('[request:cloud] success', {
          functionName,
          path: url,
          result: response && response.result
        })

        try {
          resolve(normalizeCloudResponse(response))
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        console.log('[request:cloud] fail', {
          functionName,
          path: url,
          error
        })
        reject(error)
      }
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
    showErrorToast = true
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
  const token = wx.getStorageSync('token')
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header
  }

  if (token) {
    requestHeader.Authorization = `Bearer ${token}`
  }

  const transportRequest = transport === 'cloud' ? cloudRequest : httpRequest

  return transportRequest({
    url,
    method,
    data,
    header: requestHeader,
    token
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
