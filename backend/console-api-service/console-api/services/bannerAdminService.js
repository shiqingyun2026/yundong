const crypto = require('node:crypto')

const { readBannerStore, writeBannerStore } = require('../../shared/services/bannerStore')
const { getBannerStatus, syncBannerStoreStatus } = require('../../shared/services/bannerState')
const { writeAdminLog } = require('../../utils/adminStore')
const { formatDateTime, getPagination, parseShanghaiDateTimeInput } = require('../routes/_helpers')
const { ensureCondition, ensureFound } = require('./_guards')

const BANNER_JUMP_TYPES = ['none', 'packageDetail', 'customUrl', 'miniprogramPage']

const normalizeText = value => `${value || ''}`.trim()

const normalizeDateTimeValue = value => {
  if (value === undefined) {
    return undefined
  }

  if (value === null || value === '') {
    return null
  }

  const isoValue = parseShanghaiDateTimeInput(value)
  if (!isoValue) {
    return null
  }

  const date = new Date(isoValue)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const parseDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[admin/banner] write admin log failed', error)
  }
}

const mapBannerListItem = item => ({
  id: item.id,
  image_url: item.image_url || '',
  title: item.title || '',
  jump_type: item.jump_type || 'none',
  jump_target: item.jump_target || '',
  sort: Number(item.sort || 0),
  online_time: formatDateTime(item.online_time),
  offline_time: formatDateTime(item.offline_time),
  status: getBannerStatus(item),
  create_time: formatDateTime(item.created_at),
  update_time: formatDateTime(item.updated_at)
})

const mapBannerDetail = item => ({
  id: item.id,
  image_url: item.image_url || '',
  title: item.title || '',
  jump_type: item.jump_type || 'none',
  jump_target: item.jump_target || '',
  sort: Number(item.sort || 0),
  online_time: formatDateTime(item.online_time),
  offline_time: formatDateTime(item.offline_time),
  status: getBannerStatus(item),
  created_at: formatDateTime(item.created_at),
  updated_at: formatDateTime(item.updated_at)
})

const validateBannerPayload = (payload = {}, { partial = false, existing = null, now = new Date() } = {}) => {
  const requiredFields = [
    ['image_url', 'Banner 图片不能为空'],
    ['title', 'Banner 标题不能为空'],
    ['jump_type', '跳转类型不能为空'],
    ['online_time', '上线时间不能为空']
  ]

  requiredFields.forEach(([field, message]) => {
    if (partial && payload[field] === undefined) {
      return
    }

    ensureCondition(!!normalizeText(payload[field]), {
      responseCode: 1001,
      statusCode: 400,
      message
    })
  })

  if (!partial || payload.jump_type !== undefined) {
    ensureCondition(BANNER_JUMP_TYPES.includes(normalizeText(payload.jump_type)), {
      responseCode: 1001,
      statusCode: 400,
      message: '跳转类型不支持'
    })
  }

  if (!partial || payload.sort !== undefined) {
    ensureCondition(Number.isFinite(Number(payload.sort)), {
      responseCode: 1001,
      statusCode: 400,
      message: '排序必须为数字'
    })
  }

  const onlineTime = payload.online_time !== undefined ? normalizeDateTimeValue(payload.online_time) : existing && existing.online_time
  ensureCondition(!!onlineTime, {
    responseCode: 1001,
    statusCode: 400,
    message: '上线时间不能为空'
  })

  const onlineDate = parseDate(onlineTime)
  ensureCondition(!!onlineDate, {
    responseCode: 1001,
    statusCode: 400,
    message: '上线时间格式不正确'
  })

  if (!partial) {
    ensureCondition(onlineDate.getTime() > now.getTime(), {
      responseCode: 1001,
      statusCode: 400,
      message: '上线时间必须晚于当前时间'
    })
  }

  const offlineTime = payload.offline_time !== undefined ? normalizeDateTimeValue(payload.offline_time) : existing && existing.offline_time
  if (offlineTime) {
    const offlineDate = parseDate(offlineTime)

    ensureCondition(!!offlineDate, {
      responseCode: 1001,
      statusCode: 400,
      message: '下线时间格式不正确'
    })

    ensureCondition(offlineDate.getTime() > onlineDate.getTime(), {
      responseCode: 1001,
      statusCode: 400,
      message: '下线时间必须晚于上线时间'
    })
  }
}

const buildBannerRecord = ({ payload = {}, existing = null, now = new Date() }) => {
  const current = existing || {}
  return {
    id: current.id || crypto.randomUUID(),
    image_url: payload.image_url !== undefined ? normalizeText(payload.image_url) : current.image_url || '',
    title: payload.title !== undefined ? normalizeText(payload.title) : current.title || '',
    jump_type: payload.jump_type !== undefined ? normalizeText(payload.jump_type) : current.jump_type || 'none',
    jump_target: payload.jump_target !== undefined ? normalizeText(payload.jump_target) : current.jump_target || '',
    sort: payload.sort !== undefined ? Number(payload.sort) || 0 : Number(current.sort || 0),
    online_time:
      payload.online_time !== undefined
        ? normalizeDateTimeValue(payload.online_time)
        : current.online_time || null,
    offline_time:
      payload.offline_time !== undefined
        ? normalizeDateTimeValue(payload.offline_time)
        : current.offline_time || null,
    created_at: current.created_at || now.toISOString(),
    updated_at: now.toISOString()
  }
}

const listAdminBanners = async ({ query = {}, now = new Date() } = {}) => {
  const { page, size, from } = getPagination(query)
  const keyword = normalizeText(query.keyword).toLowerCase()
  const status = normalizeText(query.status)
  const all = await syncBannerStoreStatus({ now })

  const filtered = all
    .filter(item => {
      if (keyword) {
        const searchText = [item.title, item.jump_target].join(' ').toLowerCase()
        if (!searchText.includes(keyword)) {
          return false
        }
      }

      if (status && status !== getBannerStatus(item, now)) {
        return false
      }

      return true
    })
    .sort((left, right) => {
      const sortDelta = Number(left.sort || 0) - Number(right.sort || 0)
      if (sortDelta !== 0) {
        return sortDelta
      }

      return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    })

  return {
    total: filtered.length,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(filtered.length / size)),
    list: filtered.slice(from, from + size).map(mapBannerListItem)
  }
}

const getAdminBannerDetail = async ({ bannerId, now = new Date() }) => {
  const all = await syncBannerStoreStatus({ now })
  const banner = all.find(item => item.id === bannerId)

  ensureFound(banner, {
    responseCode: 4040,
    statusCode: 404,
    message: 'Banner 不存在'
  })

  return mapBannerDetail({
    ...banner,
    status: getBannerStatus(banner, now)
  })
}

const createAdminBanner = async ({ payload = {}, admin = {}, ip = null, now = new Date() }) => {
  validateBannerPayload(payload, { now })
  const all = await readBannerStore()
  const nextBanner = buildBannerRecord({ payload, now })
  const saved = await writeBannerStore([...all, nextBanner])
  const created = saved.find(item => item.id === nextBanner.id) || nextBanner

  await safeWriteAdminLog({
    adminId: admin.id,
    adminUsername: admin.username,
    adminRole: admin.role,
    action: 'banner_create',
    targetType: 'mini_program_banner',
    targetId: created.id,
    detail: {
      title: created.title,
      jump_type: created.jump_type,
      status: getBannerStatus(created, now)
    },
    ip
  })

  return mapBannerDetail(created)
}

const updateAdminBanner = async ({ bannerId, payload = {}, admin = {}, ip = null, now = new Date() }) => {
  const all = await readBannerStore()
  const index = all.findIndex(item => item.id === bannerId)

  ensureCondition(index >= 0, {
    responseCode: 4040,
    statusCode: 404,
    message: 'Banner 不存在'
  })

  ensureCondition(getBannerStatus(all[index], now) !== 'active', {
    responseCode: 1001,
    statusCode: 400,
    message: '已上线 Banner 不可编辑，请先下线'
  })

  validateBannerPayload(payload, { partial: true, existing: all[index], now })

  const updatedBanner = buildBannerRecord({
    payload,
    existing: all[index],
    now
  })
  const nextList = [...all]
  nextList[index] = updatedBanner
  const saved = await writeBannerStore(nextList)
  const updated = saved.find(item => item.id === bannerId) || updatedBanner

  await safeWriteAdminLog({
    adminId: admin.id,
    adminUsername: admin.username,
    adminRole: admin.role,
    action: 'banner_update',
    targetType: 'mini_program_banner',
    targetId: updated.id,
    detail: {
      title: updated.title,
      jump_type: updated.jump_type,
      status: getBannerStatus(updated, now)
    },
    ip
  })

  return mapBannerDetail(updated)
}

const offlineAdminBanner = async ({ bannerId, admin = {}, ip = null, now = new Date() }) => {
  const all = await readBannerStore()
  const index = all.findIndex(item => item.id === bannerId)

  ensureCondition(index >= 0, {
    responseCode: 4040,
    statusCode: 404,
    message: 'Banner 不存在'
  })

  ensureCondition(getBannerStatus(all[index], now) === 'active', {
    responseCode: 1001,
    statusCode: 400,
    message: '仅已上线 Banner 可下线'
  })

  const updatedBanner = buildBannerRecord({
    payload: {
      offline_time: now.toISOString()
    },
    existing: all[index],
    now
  })
  const nextList = [...all]
  nextList[index] = updatedBanner
  const saved = await writeBannerStore(nextList)
  const updated = saved.find(item => item.id === bannerId) || updatedBanner

  await safeWriteAdminLog({
    adminId: admin.id,
    adminUsername: admin.username,
    adminRole: admin.role,
    action: 'banner_offline',
    targetType: 'mini_program_banner',
    targetId: updated.id,
    detail: {
      title: updated.title,
      jump_type: updated.jump_type,
      status: getBannerStatus(updated, now)
    },
    ip
  })

  return mapBannerDetail(updated)
}

module.exports = {
  BANNER_JUMP_TYPES,
  createAdminBanner,
  getAdminBannerDetail,
  listAdminBanners,
  offlineAdminBanner,
  updateAdminBanner
}
