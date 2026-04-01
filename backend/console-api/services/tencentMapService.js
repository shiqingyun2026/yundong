const { ensureCondition, ensureFound } = require('./_guards')

const TENCENT_MAP_BASE_URL = 'https://apis.map.qq.com'

const pickFirstNonEmptyString = candidates => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

const normalizeCoordinate = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const ensureTencentMapKey = () => {
  const key = `${process.env.TENCENT_MAP_KEY || ''}`.trim()

  ensureCondition(!!key, {
    responseCode: 5000,
    statusCode: 500,
    message: '服务器配置错误：缺少腾讯地图 API Key'
  })

  return key
}

const normalizeRegionKeyword = region => {
  const parts = `${region || ''}`
    .split(/[\/,\s-]+/)
    .map(item => item.trim())
    .filter(Boolean)

  return parts[parts.length - 1] || ''
}

const buildSuggestionAddress = item => {
  const title = pickFirstNonEmptyString([item.title, item.address])
  const address = pickFirstNonEmptyString([item.address])

  if (!address) {
    return title
  }

  if (!title || address.includes(title)) {
    return address
  }

  return `${title} ${address}`.trim()
}

const requestTencentMap = async (path, searchParams) => {
  const key = ensureTencentMapKey()
  const url = new URL(`${TENCENT_MAP_BASE_URL}${path}`)

  Object.entries(searchParams || {}).forEach(([paramKey, value]) => {
    if (value !== undefined && value !== null && `${value}`.trim()) {
      url.searchParams.set(paramKey, `${value}`.trim())
    }
  })
  url.searchParams.set('key', key)

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`腾讯地图服务调用失败: ${response.status}`)
  }

  const data = await response.json()

  ensureCondition(data && data.status === 0, {
    responseCode: 5000,
    statusCode: 400,
    message: (data && data.message) || '腾讯地图 API 返回错误'
  })

  return data
}

const geocodeAddressWithTencentMap = async ({ district, detail }) => {
  const normalizedDetail = `${detail || ''}`.trim()
  const normalizedRegion = normalizeRegionKeyword(district)

  ensureCondition(!!normalizedDetail, {
    responseCode: 5000,
    statusCode: 400,
    message: '详细地点不能为空'
  })

  const data = await requestTencentMap('/ws/geocoder/v1/', {
    address: normalizedDetail,
    region: normalizedRegion
  })

  const result = ensureFound(data.result, {
    responseCode: 5000,
    message: '未查询到对应坐标'
  })
  const location = result.location || {}
  const latitude = normalizeCoordinate(location.lat)
  const longitude = normalizeCoordinate(location.lng)

  ensureCondition(latitude !== null && longitude !== null, {
    responseCode: 5000,
    message: '未查询到对应坐标'
  })

  return {
    formatted_address: pickFirstNonEmptyString([result.address, normalizedDetail]),
    latitude,
    longitude
  }
}

const searchPlacesWithTencentMap = async ({ keyword, district, limit = 8 }) => {
  const normalizedKeyword = `${keyword || ''}`.trim()
  const normalizedRegion = normalizeRegionKeyword(district) || '深圳市'

  ensureCondition(!!normalizedKeyword, {
    responseCode: 5000,
    statusCode: 400,
    message: '地点关键词不能为空'
  })

  const data = await requestTencentMap('/ws/place/v1/search', {
    keyword: normalizedKeyword,
    boundary: `region(${normalizedRegion},0)`,
    orderby: '_distance',
    page_size: `${Math.min(Math.max(Number(limit) || 8, 1), 20)}`
  })

  return (data.data || []).map(item => ({
    id: pickFirstNonEmptyString([item.id, `${item.location?.lat || ''},${item.location?.lng || ''}:${item.title || ''}`]),
    title: pickFirstNonEmptyString([item.title]),
    address: buildSuggestionAddress(item),
    latitude: normalizeCoordinate(item.location && item.location.lat),
    longitude: normalizeCoordinate(item.location && item.location.lng),
    city: pickFirstNonEmptyString([item.ad_info && item.ad_info.city]),
    district: pickFirstNonEmptyString([item.ad_info && item.ad_info.district]),
    adcode: pickFirstNonEmptyString([item.ad_info && item.ad_info.adcode])
  }))
}

module.exports = {
  geocodeAddressWithTencentMap,
  normalizeRegionKeyword,
  searchPlacesWithTencentMap
}
