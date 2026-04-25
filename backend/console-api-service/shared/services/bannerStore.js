const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const miniProgramBannersRepository = require('../../repositories/miniProgramBannersRepository')

const STORE_PATH = path.join(__dirname, '../../data/miniprogram-banners.json')

const DEFAULT_BANNERS = [
  {
    id: 'home-banner-fitness-spring',
    image_url: '',
    title: '体适能春季课程',
    jump_type: 'none',
    jump_target: '',
    sort: 10,
    online_time: '2026-01-01T00:00:00.000Z',
    offline_time: '2027-01-01T00:00:00.000Z',
    status: 'active',
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z'
  },
  {
    id: 'home-banner-package-detail-demo',
    image_url: '',
    title: '连续 5 次训练计划',
    jump_type: 'packageDetail',
    jump_target: 'package-1',
    sort: 20,
    online_time: '2026-01-01T00:00:00.000Z',
    offline_time: '2027-01-01T00:00:00.000Z',
    status: 'active',
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z'
  },
  {
    id: 'home-banner-location-search',
    image_url: '',
    title: '按社区快速找课',
    jump_type: 'miniprogramPage',
    jump_target: '/pages/location-search/index',
    sort: 30,
    online_time: '2026-01-01T00:00:00.000Z',
    offline_time: '2027-01-01T00:00:00.000Z',
    status: 'active',
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z'
  }
]

const normalizeText = value => `${value || ''}`.trim()

const isDatabaseUnavailable = error =>
  error &&
  (
    error.code === 'MYSQL2_MISSING' ||
    error.code === 'ER_NO_SUCH_TABLE' ||
    error.code === 'ER_BAD_DB_ERROR' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ETIMEDOUT' ||
    /mysql/i.test(error.message || '')
  )

const normalizeBannerRecord = item => ({
  id: normalizeText(item && item.id) || crypto.randomUUID(),
  image_url: normalizeText(item && item.image_url),
  title: normalizeText(item && item.title),
  jump_type: normalizeText(item && item.jump_type) || 'none',
  jump_target: normalizeText(item && item.jump_target),
  sort: Number(item && item.sort) || 0,
  online_time: item && item.online_time ? new Date(item.online_time).toISOString() : null,
  offline_time: item && item.offline_time ? new Date(item.offline_time).toISOString() : null,
  status: normalizeText(item && item.status) || '',
  created_at: item && item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
  updated_at: item && item.updated_at ? new Date(item.updated_at).toISOString() : new Date().toISOString()
})

const ensureStoreFile = async () => {
  try {
    await fs.access(STORE_PATH)
  } catch (error) {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
    await fs.writeFile(STORE_PATH, `${JSON.stringify(DEFAULT_BANNERS, null, 2)}\n`, 'utf8')
  }
}

const readBannerStore = async () => {
  try {
    const records = await miniProgramBannersRepository.listBanners()
    return records.map(normalizeBannerRecord)
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      throw error
    }
  }

  await ensureStoreFile()
  const raw = await fs.readFile(STORE_PATH, 'utf8')

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeBannerRecord) : DEFAULT_BANNERS.map(normalizeBannerRecord)
  } catch (error) {
    return DEFAULT_BANNERS.map(normalizeBannerRecord)
  }
}

const writeBannerStore = async banners => {
  const normalized = (Array.isArray(banners) ? banners : []).map(normalizeBannerRecord)
  try {
    return await miniProgramBannersRepository.replaceBanners(normalized)
  } catch (error) {
    if (!isDatabaseUnavailable(error)) {
      throw error
    }
  }

  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

module.exports = {
  STORE_PATH,
  normalizeBannerRecord,
  readBannerStore,
  writeBannerStore
}
