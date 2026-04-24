const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const STORE_PATH = path.join(__dirname, '../../data/miniprogram-banners.json')

const DEFAULT_BANNERS = [
  {
    id: 'home-banner-fitness-spring',
    image_url: '',
    title: '体适能春季课程',
    kicker: 'PROMOTIONAL WORK',
    description: '首页 Banner 已切换为接口读取，当前示例位可被后台正式投放配置替换。',
    jump_type: 'none',
    jump_target: '',
    sort: 10,
    online_time: '2026-01-01T00:00:00.000Z',
    offline_time: '2027-01-01T00:00:00.000Z',
    city_codes: ['全国'],
    enabled: true,
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z'
  }
]

const normalizeText = value => `${value || ''}`.trim()

const normalizeCityCodes = value => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map(item => normalizeText(item).replace(/市$/, '')).filter(Boolean))]
}

const normalizeBannerRecord = item => ({
  id: normalizeText(item && item.id) || crypto.randomUUID(),
  image_url: normalizeText(item && item.image_url),
  title: normalizeText(item && item.title),
  kicker: normalizeText(item && item.kicker),
  description: normalizeText(item && item.description),
  jump_type: normalizeText(item && item.jump_type) || 'none',
  jump_target: normalizeText(item && item.jump_target),
  sort: Number(item && item.sort) || 0,
  online_time: item && item.online_time ? new Date(item.online_time).toISOString() : null,
  offline_time: item && item.offline_time ? new Date(item.offline_time).toISOString() : null,
  city_codes: normalizeCityCodes(item && item.city_codes),
  enabled: !!(item && item.enabled),
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
