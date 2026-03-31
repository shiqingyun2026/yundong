const DEFAULT_LOCATION_NAME = '当前位置'
const DEFAULT_CITY = '深圳'
const DEFAULT_LOCATION = {
  latitude: 22.7215,
  longitude: 114.251,
  name: '龙岗区',
  address: '深圳市龙岗区',
  city: '深圳',
  district: '龙岗区',
  source: 'default'
}

const getRuntimeApp = () => {
  try {
    return getApp()
  } catch (error) {
    return null
  }
}

const isFiniteNumber = value => Number.isFinite(Number(value))

const pickFirstString = values => {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const joinLocationParts = parts => parts.filter(Boolean).join(' · ')

const normalizeFunctionPayload = payload => {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  if (payload.result && typeof payload.result === 'object') {
    return payload.result
  }

  if (payload.data && typeof payload.data === 'object') {
    return normalizeFunctionPayload(payload.data)
  }

  return payload
}

const buildLocationName = payload => {
  const adInfo = payload.ad_info || payload.adInfo || {}
  const addressComponent = payload.address_component || payload.addressComponent || {}
  const formattedAddresses = payload.formatted_addresses || payload.formattedAddresses || {}
  const addressReference = payload.address_reference || payload.addressReference || {}
  const landmarkLevel2 =
    (addressReference.landmark_l2 && addressReference.landmark_l2.title) ||
    (addressReference.landmarkL2 && addressReference.landmarkL2.title) ||
    ''
  const district = pickFirstString([
    payload.district,
    adInfo.district,
    addressComponent.district
  ])
  const town =
    pickFirstString([
      payload.town,
      addressComponent.township,
      addressComponent.town
    ]) ||
    pickFirstString([
      addressReference.town && addressReference.town.title
    ])
  const province = pickFirstString([
    payload.province,
    adInfo.province,
    addressComponent.province
  ])
  const city = pickFirstString([
    payload.city,
    adInfo.city,
    addressComponent.city,
    payload.region
  ])

  return pickFirstString([
    payload.name,
    payload.locationText,
    payload.displayName,
    payload.display_name,
    formattedAddresses.recommend,
    formattedAddresses.rough,
    joinLocationParts([district, town]),
    joinLocationParts([city, district, landmarkLevel2]),
    joinLocationParts([province, city, district]),
    joinLocationParts([city, district]),
    joinLocationParts([province, city]),
    district,
    payload.formatted_address,
    payload.formattedAddress,
    payload.address,
    DEFAULT_LOCATION_NAME
  ])
}

const buildAddress = payload =>
  pickFirstString([
    payload.address,
    payload.formatted_address,
    payload.formattedAddress
  ])

const normalizeLocation = (payload, fallback, source = '') => {
  const coordinates = normalizeCoordinates(payload, fallback)
  const adInfo = payload.ad_info || payload.adInfo || {}
  const addressComponent = payload.address_component || payload.addressComponent || {}

  return {
    ...coordinates,
    name: buildLocationName(payload),
    address: buildAddress(payload),
    city: pickFirstString([payload.city, adInfo.city, addressComponent.city, fallback.city]),
    district: pickFirstString([
      payload.district,
      adInfo.district,
      addressComponent.district,
      fallback.district
    ]),
    source: source || payload.source || fallback.source || 'gps'
  }
}

const normalizeCoordinates = (payload, fallback) => ({
  latitude: isFiniteNumber(payload.latitude)
    ? Number(payload.latitude)
    : isFiniteNumber(payload.lat)
      ? Number(payload.lat)
      : fallback.latitude,
  longitude: isFiniteNumber(payload.longitude)
    ? Number(payload.longitude)
    : isFiniteNumber(payload.lng)
      ? Number(payload.lng)
      : isFiniteNumber(payload.lon)
        ? Number(payload.lon)
        : fallback.longitude
})

const callLocationCloudFunction = ({ latitude, longitude }) =>
  new Promise((resolve, reject) => {
    const app = getRuntimeApp()
    const functionName =
      app && app.globalData ? app.globalData.cloudLocationFunctionName || 'ip-geolocation' : 'ip-geolocation'

    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject(new Error('当前基础库不支持云函数调用'))
      return
    }

    wx.cloud.callFunction({
      name: functionName,
      data: {
        latitude,
        longitude,
        lat: latitude,
        lng: longitude
      },
      success: resolve,
      fail: reject
    })
  })

const resolveLocationDetails = async ({ latitude, longitude }) => {
  const fallbackLocation = {
    latitude,
    longitude,
    name: DEFAULT_LOCATION_NAME,
    address: '',
    source: 'coordinates'
  }

  try {
    const response = await callLocationCloudFunction({
      latitude,
      longitude
    })
    const payload = normalizeFunctionPayload(response && response.result ? response.result : response)

    if (payload.status && payload.status !== 'success') {
      throw new Error(payload.message || '云函数定位失败')
    }

    return normalizeLocation(payload, fallbackLocation, payload.source || 'gps')
  } catch (error) {
    console.warn('[location] cloud function resolve failed', error)
    return fallbackLocation
  }
}

const searchLocationPOI = ({ keyword, city = DEFAULT_CITY }) =>
  new Promise((resolve, reject) => {
    const app = getRuntimeApp()
    const functionName =
      app && app.globalData ? app.globalData.cloudLocationFunctionName || 'ip-geolocation' : 'ip-geolocation'

    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject(new Error('当前基础库不支持云函数调用'))
      return
    }

    wx.cloud.callFunction({
      name: functionName,
      data: {
        action: 'search',
        keyword,
        city
      },
      success: res => {
        const payload = normalizeFunctionPayload(res && res.result ? res.result : res)
        if (payload.status && payload.status !== 'success') {
          reject(new Error(payload.message || '搜索地址失败'))
          return
        }

        resolve(
          (payload.list || []).map(item =>
            ({
              ...normalizeLocation(
                {
                  ...item,
                  name: item.name || item.title,
                  address: item.address,
                  city: item.city,
                  district: item.district
                },
                DEFAULT_LOCATION,
                'manual'
              ),
              distance: item.distance || 0
            })
          )
        )
      },
      fail: reject
    })
  })

module.exports = {
  DEFAULT_CITY,
  DEFAULT_LOCATION,
  DEFAULT_LOCATION_NAME,
  normalizeLocation,
  resolveLocationDetails,
  searchLocationPOI
}
