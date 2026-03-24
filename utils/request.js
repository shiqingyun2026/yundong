const app = getApp()

const DEFAULT_ERROR_MESSAGE = '网络开小差了，请稍后再试'

const resolveBaseURL = () => {
  if (app && app.globalData && app.globalData.baseURL) {
    return app.globalData.baseURL
  }

  return 'http://127.0.0.1:8000'
}

const showToast = message => {
  wx.showToast({
    title: message || DEFAULT_ERROR_MESSAGE,
    icon: 'none'
  })
}

const normalizeResponse = response => {
  const { statusCode, data } = response
  const successStatus = statusCode >= 200 && statusCode < 300

  if (!successStatus) {
    throw {
      message: data && data.message ? data.message : DEFAULT_ERROR_MESSAGE,
      statusCode,
      data
    }
  }

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

  const token = wx.getStorageSync('token')
  const requestHeader = {
    'Content-Type': 'application/json',
    ...header
  }

  if (token) {
    requestHeader.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    const requestURL = `${resolveBaseURL()}${url}`

    console.log('[request] start', {
      url: requestURL,
      method,
      data
    })

    wx.request({
      url: requestURL,
      method,
      data,
      header: requestHeader,
      success(response) {
        console.log('[request] success', {
          url: requestURL,
          statusCode: response.statusCode,
          data: response.data
        })

        try {
          const result = normalizeResponse(response)
          resolve(result)
        } catch (error) {
          if (error && error.statusCode === 401) {
            wx.removeStorageSync('token')
          }

          if (showErrorToast) {
            showToast(error.message)
          }
          reject(error)
        }
      },
      fail(error) {
        console.log('[request] fail', {
          url: requestURL,
          error
        })

        if (showErrorToast) {
          showToast(DEFAULT_ERROR_MESSAGE)
        }
        reject(error)
      },
      complete() {
        if (showLoading) {
          wx.hideLoading()
        }
      }
    })
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
