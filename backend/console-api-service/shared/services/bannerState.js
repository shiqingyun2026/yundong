const { readBannerStore, writeBannerStore } = require('./bannerStore')

const parseDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getBannerStatus = (banner, now = new Date()) => {
  const offlineTime = parseDate(banner && banner.offline_time)
  if (offlineTime && offlineTime.getTime() <= now.getTime()) {
    return 'inactive'
  }

  const onlineTime = parseDate(banner && banner.online_time)
  if (onlineTime && onlineTime.getTime() <= now.getTime()) {
    return 'active'
  }

  return 'pending'
}

const syncBannerStoreStatus = async ({ banners = null, now = new Date() } = {}) => {
  const source = Array.isArray(banners) ? banners : await readBannerStore()
  let changed = false

  const nextBanners = source.map(item => {
    const currentStatus = item && item.status ? item.status : ''
    const computedStatus = getBannerStatus(item, now)

    if (currentStatus === computedStatus) {
      return item
    }

    changed = true
    return {
      ...item,
      status: computedStatus,
      updated_at: now.toISOString()
    }
  })

  if (!changed) {
    return nextBanners
  }

  return writeBannerStore(nextBanners)
}

module.exports = {
  getBannerStatus,
  syncBannerStoreStatus
}
