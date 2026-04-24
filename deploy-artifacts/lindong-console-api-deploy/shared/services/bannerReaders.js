const { syncBannerStoreStatus, getBannerStatus } = require('./bannerState')
const { signCosPublicUrl } = require('./cosSignedUrl')

const normalizeText = value => `${value || ''}`.trim()

const isBannerVisible = ({ banner, now = new Date() }) => !!banner && getBannerStatus(banner, now) === 'active'

const fetchMiniProgramHomeBanners = async ({ city = '', now = new Date() } = {}) => {
  const storedBanners = await syncBannerStoreStatus({ now })
  const list = storedBanners.filter(banner => isBannerVisible({ banner, now }))
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
      jump_type: normalizeText(item.jump_type) || 'none',
      jump_target: normalizeText(item.jump_target),
      sort: Number(item.sort || 0),
      online_time: item.online_time || null,
      offline_time: item.offline_time || null
    }))

  return {
    list
  }
}

module.exports = {
  fetchMiniProgramHomeBanners
}
