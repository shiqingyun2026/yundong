const DEFAULT_ERROR_MESSAGE = '网络开小差了，请稍后再试'
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const CLOUD_CONTAINER_SERVICE_MISSING_MESSAGE = '请先配置云托管服务名'

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

const resolveCloudContainerServiceName = () => {
  const app = getRuntimeApp()

  if (app && app.globalData && app.globalData.cloudContainerServiceName) {
    return app.globalData.cloudContainerServiceName
  }

  return ''
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

const containerRequest = ({ url, method, data, header, token }) =>
  new Promise((resolve, reject) => {
    if (!wx.cloud || typeof wx.cloud.callContainer !== 'function') {
      reject(new Error('当前基础库不支持云托管调用'))
      return
    }

    if (!isCloudReady()) {
      reject(new Error('云开发尚未初始化，请先完成云环境配置'))
      return
    }

    const serviceName = resolveCloudContainerServiceName()

    if (!serviceName) {
      reject(new Error(CLOUD_CONTAINER_SERVICE_MISSING_MESSAGE))
      return
    }

    const app = getRuntimeApp()
    const cloudEnv = app && app.globalData ? app.globalData.cloudEnv : ''

    console.log('[request:container] start', {
      serviceName,
      cloudEnv,
      path: url,
      method,
      data,
      hasToken: !!token
    })

    wx.cloud.callContainer({
      config: cloudEnv
        ? {
            env: cloudEnv
          }
        : undefined,
      path: url,
      method,
      header: {
        ...header,
        'X-WX-SERVICE': serviceName
      },
      data,
      success(response) {
        console.log('[request:container] success', {
          serviceName,
          path: url,
          statusCode: response && response.statusCode,
          data: response && response.data
        })

        try {
          resolve(normalizeContainerResponse(response))
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        console.log('[request:container] fail', {
          serviceName,
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

  const transportRequest = transport === 'container' ? containerRequest : httpRequest

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
