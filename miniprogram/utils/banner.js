const { get } = require('./request')

const normalizeBanner = item => ({
  id: item.id || '',
  image: item.image_url || item.image || '',
  title: item.title || '',
  kicker: item.kicker || '',
  desc: item.description || item.desc || '',
  jumpType: item.jump_type || item.jumpType || 'none',
  jumpTarget: item.jump_target || item.jumpTarget || '',
  sort: Number(item.sort || 0) || 0
})

const fetchHomeBannerList = async ({ city = '' } = {}) => {
  const payload = await get(
    '/api/banners',
    { city },
    {
      showErrorToast: false
    }
  )
  const list = Array.isArray(payload && payload.list) ? payload.list : []

  return list.map(normalizeBanner)
}

module.exports = {
  fetchHomeBannerList
}
