const { readBannerStore } = require('./bannerStore')
const { signCosPublicUrl } = require('./cosSignedUrl')

const normalizeText = value => `${value || ''}`.trim()

const normalizeCityCode = value => normalizeText(value).replace(/市$/, '')

const parseDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeCityCodes = value => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(normalizeCityCode).filter(Boolean)
}

const isBannerVisible = ({ banner, city = '', now = new Date() }) => {
  if (!banner || !banner.enabled) {
    return false
  }

  const onlineTime = parseDate(banner.online_time)
  if (onlineTime && onlineTime.getTime() > now.getTime()) {
    return false
  }

  const offlineTime = parseDate(banner.offline_time)
  if (offlineTime && offlineTime.getTime() <= now.getTime()) {
    return false
  }

  const cityCodes = normalizeCityCodes(banner.city_codes)
  if (!cityCodes.length) {
    return true
  }

  const normalizedCity = normalizeCityCode(city)
  if (!normalizedCity) {
    return cityCodes.includes('全国')
  }

  return cityCodes.includes('全国') || cityCodes.includes(normalizedCity)
}

const fetchMiniProgramHomeBanners = async ({ city = '', now = new Date() } = {}) => {
  const storedBanners = await readBannerStore()
  const list = storedBanners.filter(banner => isBannerVisible({ banner, city, now }))
    .sort((left, right) => {
      const sortDelta = Number(left.sort || 0) - Number(right.sort || 0)
      if (sortDelta !== 0) {
        return sortDelta
      }

      return 0
    })
    .map(item => ({
      id: item.id,
      image_url: signCosPublicUrl(item.image_url || ''),
      title: normalizeText(item.title),
      kicker: normalizeText(item.kicker),
      description: normalizeText(item.description),
      jump_type: normalizeText(item.jump_type) || 'none',
      jump_target: normalizeText(item.jump_target),
      sort: Number(item.sort || 0),
      online_time: item.online_time || null,
      offline_time: item.offline_time || null,
      city_codes: normalizeCityCodes(item.city_codes),
      enabled: !!item.enabled
    }))

  return {
    list
  }
}

module.exports = {
  fetchMiniProgramHomeBanners
}
