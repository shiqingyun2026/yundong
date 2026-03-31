const DEFAULT_LOCATION_NAME = '当前位置'

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

    const coordinates = normalizeCoordinates(payload, fallbackLocation)

    return {
      ...coordinates,
      name: buildLocationName(payload),
      address: buildAddress(payload),
      source: 'cloud-function'
    }
  } catch (error) {
    console.warn('[location] cloud function resolve failed', error)
    return fallbackLocation
  }
}

module.exports = {
  DEFAULT_LOCATION_NAME,
  resolveLocationDetails
}
