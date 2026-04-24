const { createOkHandler } = require('./_helpers')
const {
  createAdminBanner,
  getAdminBannerDetail,
  listAdminBanners,
  offlineAdminBanner,
  updateAdminBanner
} = require('../services/bannerAdminService')

const listAdminBannersHandler = createOkHandler('获取 Banner 列表失败', req =>
  listAdminBanners({
    query: req.query || {}
  })
)

const getAdminBannerDetailHandler = createOkHandler('获取 Banner 详情失败', req =>
  getAdminBannerDetail({
    bannerId: req.params.id
  })
)

const createAdminBannerHandler = createOkHandler('创建 Banner 失败', req =>
  createAdminBanner({
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const updateAdminBannerHandler = createOkHandler('更新 Banner 失败', req =>
  updateAdminBanner({
    bannerId: req.params.id,
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const offlineAdminBannerHandler = createOkHandler('下线 Banner 失败', req =>
  offlineAdminBanner({
    bannerId: req.params.id,
    admin: req.admin || {},
    ip: req.ip || null
  })
)

module.exports = {
  createAdminBannerHandler,
  getAdminBannerDetailHandler,
  listAdminBannersHandler,
  offlineAdminBannerHandler,
  updateAdminBannerHandler
}
