const { get, post } = require('./request')
const { formatHourMinute, formatMonthDay } = require('./util')

const WEEKDAY_LABELS = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日'
}

const START_HOUR_OPTIONS = [9, 10, 11, 14, 15, 16, 17, 18, 19]

const pickFirstNonEmptyString = values => {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === null || value === undefined) {
      continue
    }

    const normalized = `${value}`.trim()
    if (normalized) {
      return normalized
    }
  }

  return ''
}

const escapeRegExp = value => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const collapseLocationText = value =>
  `${value || ''}`
    .replace(/[／]/g, '/')
    .replace(/[，,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()

const dedupeOrderedParts = parts => {
  const result = []

  parts.forEach(part => {
    if (!part) {
      return
    }

    const normalized = collapseLocationText(part)
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
  })

  return result
}

const stripKnownLocationSegments = (value, segments = []) => {
  let normalized = collapseLocationText(value)
  if (!normalized) {
    return ''
  }

  segments
    .filter(Boolean)
    .sort((left, right) => `${right}`.length - `${left}`.length)
    .forEach(segment => {
      const pattern = new RegExp(escapeRegExp(segment), 'g')
      normalized = normalized.replace(pattern, ' ')
    })

  return collapseLocationText(
    normalized
      .replace(/[\u4e00-\u9fa5]{2,}(省|自治区|特别行政区)/g, ' ')
      .replace(/\s*\/\s*/g, ' ')
      .replace(/\s+/g, ' ')
  )
}

const formatLocationFallbackText = (value, province = '') => {
  const normalized = collapseLocationText(value)
  if (!normalized) {
    return ''
  }

  const slashParts = normalized
    .split('/')
    .map(part => collapseLocationText(part))
    .filter(Boolean)

  if (slashParts.length > 1) {
    const filteredParts = slashParts.filter(part => part !== collapseLocationText(province) && !/省$/.test(part))
    return dedupeOrderedParts(filteredParts).join(' / ')
  }

  return stripKnownLocationSegments(normalized, [province])
}

const extractLocationLeafPart = (value, province = '') => {
  const normalized = formatLocationFallbackText(value, province)
  if (!normalized) {
    return ''
  }

  const slashParts = normalized
    .split('/')
    .map(part => collapseLocationText(part))
    .filter(Boolean)

  return slashParts.length ? slashParts[slashParts.length - 1] : normalized
}

const extractLocationPathParts = (value, province = '') => {
  const normalized = formatLocationFallbackText(value, province)
  if (!normalized) {
    return []
  }

  return normalized
    .split('/')
    .map(part => collapseLocationText(part))
    .filter(Boolean)
}

const formatPackageLocationText = payload => {
  const source = payload || {}
  const province = pickFirstNonEmptyString([source.location_province, source.locationProvince])
  const city = extractLocationLeafPart(
    pickFirstNonEmptyString([source.location_city, source.locationCity]),
    province
  )
  const districtPathParts = extractLocationPathParts(
    pickFirstNonEmptyString([source.location_district, source.locationDistrict]),
    province
  )
  const district = districtPathParts.length ? districtPathParts[districtPathParts.length - 1] : ''
  const fallbackCity = !city && districtPathParts.length > 1 ? districtPathParts[districtPathParts.length - 2] : ''
  const community = pickFirstNonEmptyString([source.location_community, source.locationCommunity])
  const detail = pickFirstNonEmptyString([source.location_detail, source.locationDetail])
  const fallbackText = pickFirstNonEmptyString([source.location_text, source.locationText])
  const resolvedCity = city || fallbackCity

  const locationSegments = dedupeOrderedParts([province, resolvedCity, district, community])
  const compactLocationSegments = dedupeOrderedParts([
    collapseLocationText(province).replace(/\s*\/\s*/g, ''),
    collapseLocationText(resolvedCity).replace(/\s*\/\s*/g, ''),
    collapseLocationText(district).replace(/\s*\/\s*/g, '')
  ])
  const normalizedCommunity = extractLocationLeafPart(community, province)
  let normalizedDetail = extractLocationLeafPart(
    stripKnownLocationSegments(detail, [...locationSegments, ...compactLocationSegments]),
    province
  )

  if (normalizedCommunity && normalizedDetail) {
    if (normalizedDetail.includes(normalizedCommunity)) {
      normalizedDetail = collapseLocationText(normalizedDetail.replace(new RegExp(escapeRegExp(normalizedCommunity), 'g'), ' '))
    } else if (normalizedCommunity.includes(normalizedDetail)) {
      normalizedDetail = ''
    }
  }

  const venueText = dedupeOrderedParts([normalizedCommunity, normalizedDetail]).join(' ')
  const formatted = dedupeOrderedParts([collapseLocationText(resolvedCity), collapseLocationText(district), venueText])

  if (formatted.length) {
    return formatted.join(' / ')
  }

  return formatLocationFallbackText(fallbackText, province)
}

const normalizeListPayload = payload => {
  const data = payload || {}
  const list = Array.isArray(data.list) ? data.list : []
  const page = Number(data.page) || 1
  const pageSize = Number(data.pageSize || data.size) || 10
  const total = Number(data.total) || 0

  return {
    list,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total
  }
}

const formatFenText = value => {
  const amountFen = Number(value || 0)
  return (amountFen / 100).toFixed(2)
}

const formatDisplayAmount = value => {
  const normalized = `${value === null || value === undefined ? '' : value}`.trim()
  if (!normalized) {
    return '0'
  }

  if (/^-?\d+\.00$/.test(normalized)) {
    return normalized.slice(0, -3)
  }

  return normalized
}

const normalizeGroupPriceConfig = value => {
  const items = Array.isArray(value) ? value : []

  return items
    .map(item => ({
      targetCount: Number(item && (item.target_count || item.targetCount)) || 0,
      priceFen: Number(item && (item.price_fen || item.priceFen)) || 0
    }))
    .filter(item => item.targetCount > 0 && item.priceFen > 0)
    .sort((left, right) => left.targetCount - right.targetCount)
}

const findConfiguredMemberAmountFen = ({ groupPriceConfig = [], targetCount }) => {
  const normalizedTargetCount = Number(targetCount) || 0
  if (normalizedTargetCount <= 0) {
    return 0
  }

  const matched = normalizeGroupPriceConfig(groupPriceConfig).find(item => item.targetCount === normalizedTargetCount)
  return matched ? matched.priceFen : 0
}

const calculatePackageMemberAmountFen = ({ totalPriceFen, targetCount, groupPriceConfig = [] }) => {
  const configuredAmountFen = findConfiguredMemberAmountFen({
    groupPriceConfig,
    targetCount
  })

  if (configuredAmountFen > 0) {
    return configuredAmountFen
  }

  const normalizedTotalPriceFen = Number(totalPriceFen) || 0
  const normalizedTargetCount = Number(targetCount) || 0

  if (normalizedTotalPriceFen < 0 || normalizedTargetCount <= 0) {
    return 0
  }

  return Math.floor(normalizedTotalPriceFen / normalizedTargetCount)
}

const buildPackageFeatureTags = payload => {
  const tags = []
  const classCount = Number(payload.class_count || payload.classCount || 5)
  const duration = Number(payload.class_duration_minutes || payload.classDurationMinutes || 60)

  if (classCount > 0) {
    tags.push(`包含${classCount}节课`)
  }

  if (duration > 0) {
    tags.push(`课时长${duration}分钟`)
  }

  tags.push('上课时间家长定')

  return tags
}

const buildSupportedGroupPriceList = payload => {
  const supportedPeople = Array.isArray(payload.supported_people)
    ? payload.supported_people.map(item => Number(item)).filter(Boolean)
    : []
  const groupPriceConfig = normalizeGroupPriceConfig(payload.group_price_config || payload.groupPriceConfig)
  const configuredPriceMap = new Map(groupPriceConfig.map(item => [item.targetCount, item.priceFen]))
  const totalPriceFen = Number(payload.total_price_fen || payload.totalPriceFen) || 0

  return supportedPeople
    .map(count => ({
      count,
      memberAmountFen: calculatePackageMemberAmountFen({
        totalPriceFen,
        targetCount: count,
        groupPriceConfig
      })
    }))
    .filter(item => item.memberAmountFen > 0)
    .map(item => ({
      count: item.count,
      memberAmountFen: item.memberAmountFen,
      memberAmountText: formatFenText(item.memberAmountFen),
      memberAmountDisplayText: formatDisplayAmount(formatFenText(item.memberAmountFen)),
      configured: configuredPriceMap.has(item.count)
    }))
}

const safeDate = value => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatCountdownText = remainingSeconds => {
  const seconds = Math.max(0, Number(remainingSeconds) || 0)
  if (!seconds) {
    return '已截止'
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `剩余 ${days} 天 ${hours} 小时`
  }

  if (hours > 0) {
    return `剩余 ${hours} 小时 ${minutes} 分`
  }

  if (minutes > 0) {
    return `剩余 ${minutes} 分钟`
  }

  return '即将截止'
}

const formatCountdownPlainText = remainingSeconds =>
  formatCountdownText(remainingSeconds).replace(/^剩余\s*/, '')

const formatPackageDateTimeText = value => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${formatMonthDay(date)} ${WEEKDAY_LABELS[date.getDay() === 0 ? 7 : date.getDay()]} ${formatHourMinute(date)}`
}

const formatScheduleList = scheduleList =>
  (scheduleList || []).map(item => ({
    ...item,
    display_text: item.display_text || formatPackageDateTimeText(item.class_time)
  }))

const normalizePackageCard = item => ({
  id: item.package_id || item.packageId || item.id || '',
  name: item.name || '',
  cover: item.cover || '',
  packageCategory: item.package_category || '体适能',
  ageRange: item.age_range || item.ageRange || '',
  classCount: Number(item.class_count || item.classCount) || 0,
  maxSupportedPeople: Number(item.max_supported_people) || 0,
  minMemberAmountFen: Number(item.min_member_amount_fen) || 0,
  minMemberAmountText: `${item.min_member_amount_text || formatFenText(item.min_member_amount_fen)}`,
  minMemberAmountDisplayText: formatDisplayAmount(item.min_member_amount_text || formatFenText(item.min_member_amount_fen)),
  locationProvince: item.location_province || item.locationProvince || '',
  locationCity: item.location_city || item.locationCity || '',
  locationDistrict: item.location_district || '',
  locationCommunity: item.location_community || '',
  locationDetail: item.location_detail || '',
  locationText: formatPackageLocationText(item),
  locationDisplayText: formatPackageLocationText(item),
  activeGroupCount: Number(item.active_group_count) || 0,
  distanceMeters: Number.isFinite(Number(item.distance_meters)) ? Number(item.distance_meters) : null,
  createdAt: item.created_at || ''
})

const normalizeActiveGroup = item => {
  const targetCount = Number(item.target_count) || 0
  const currentCount = Number(item.current_count) || 0
  const missingCount = Math.max(0, targetCount - currentCount)
  const canJoin = (item.status || 'active') === 'active' && currentCount < targetCount

  return {
    id: item.id || '',
    targetCount,
    currentCount,
    status: item.status || 'active',
    remainingSeconds: Math.max(0, Number(item.remaining_seconds) || 0),
    remainingText: formatCountdownText(item.remaining_seconds),
    remainingPlainText: formatCountdownPlainText(item.remaining_seconds),
    memberAmountFen: Number(item.member_amount_fen) || 0,
    memberAmountText: `${item.member_amount_text || formatFenText(item.member_amount_fen)}`,
    memberAmountDisplayText: formatDisplayAmount(item.member_amount_text || formatFenText(item.member_amount_fen)),
    scheduleText: item.schedule_text || '时间待定',
    progressText: `${currentCount}/${targetCount}`,
    missingCount,
    joinButtonText: canJoin ? `还缺${missingCount}人，立即拼` : '已满员',
    canJoin
  }
}

const normalizePackageDetail = payload => ({
  id: payload.id || '',
  name: payload.name || '',
  cover: payload.cover || '',
  images: Array.isArray(payload.images) && payload.images.length ? payload.images : payload.cover ? [payload.cover] : [],
  totalPriceFen: Number(payload.total_price_fen) || 0,
  totalPriceText: `${payload.total_price_text || formatFenText(payload.total_price_fen)}`,
  totalPriceDisplayText: formatDisplayAmount(payload.total_price_text || formatFenText(payload.total_price_fen)),
  ageRange: payload.age_range || payload.ageRange || '',
  groupPriceConfig: normalizeGroupPriceConfig(payload.group_price_config || payload.groupPriceConfig),
  supportedPeople: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => Number(item)).filter(Boolean) : [],
  supportedPeopleText: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => `${item}人团`).join(' | ') : '',
  featureTags: buildPackageFeatureTags(payload),
  supportedGroupPriceList: buildSupportedGroupPriceList(payload),
  locationProvince: payload.location_province || payload.locationProvince || '',
  locationCity: payload.location_city || payload.locationCity || '',
  locationDistrict: payload.location_district || '',
  locationCommunity: payload.location_community || '',
  locationDetail: payload.location_detail || '',
  locationText: formatPackageLocationText(payload),
  locationDisplayText: formatPackageLocationText(payload),
  coachName: payload.coach_name || '',
  coachIntro: payload.coach_intro || '',
  coachCertificates: Array.isArray(payload.coach_certificates) ? payload.coach_certificates : [],
  description: payload.description || '',
  insuranceDesc: payload.insurance_desc || '',
  activeGroups: Array.isArray(payload.active_groups) ? payload.active_groups.map(normalizeActiveGroup) : []
})

const normalizePackageGroupDetail = payload => ({
  id: payload.id || '',
  status: payload.status || 'active',
  packageInfo: {
    id: payload.package && payload.package.id ? payload.package.id : '',
    name: payload.package && payload.package.name ? payload.package.name : '',
    ageRange: payload.package && payload.package.age_range ? payload.package.age_range : '',
    locationText: payload.package ? formatPackageLocationText(payload.package) : ''
  },
  targetCount: Number(payload.target_count) || 0,
  currentCount: Number(payload.current_count) || 0,
  remainingSeconds: Math.max(0, Number(payload.remaining_seconds) || 0),
  remainingText: formatCountdownText(payload.remaining_seconds),
  remainingPlainText: formatCountdownPlainText(payload.remaining_seconds),
  memberAmountFen: Number(payload.member_amount_fen) || 0,
  memberAmountText: `${payload.member_amount_text || formatFenText(payload.member_amount_fen)}`,
  memberAmountDisplayText: formatDisplayAmount(payload.member_amount_text || formatFenText(payload.member_amount_fen)),
  scheduleMode: payload.schedule_mode || 'pending',
  scheduleText: payload.schedule_text || '',
  firstClassTime: payload.first_class_time || '',
  firstClassTimeText: payload.first_class_time ? formatPackageDateTimeText(payload.first_class_time) : '',
  scheduleList: formatScheduleList(payload.schedule_list),
  childNickname: payload.child_nickname || '',
  childAge: payload.child_age === null || payload.child_age === undefined ? null : Number(payload.child_age) || 0,
  members: Array.isArray(payload.members)
    ? payload.members.map(member => ({
        ...member,
        displayName: member.display_name || member.child_nickname || member.nickname || '孩子昵称未填写'
      }))
    : [],
  userJoined: !!payload.user_joined,
  progressPercent:
    Number(payload.target_count) > 0
      ? `${Math.min(100, Math.round((Number(payload.current_count) / Number(payload.target_count)) * 100))}%`
      : '0%'
})

const normalizeUserPackageGroupListItem = item => ({
  orderId: item.order_id || item.orderId || '',
  packageGroupId: item.package_group_id || '',
  packageId: item.package_id || '',
  packageName: item.package_name || '',
  status: item.status || 'active',
  locationText: formatPackageLocationText(item),
  currentCount: Number(item.current_count) || 0,
  targetCount: Number(item.target_count) || 0,
  missingCount: Math.max(0, Number(item.missing_count) || 0),
  firstClassTime: item.first_class_time || '',
  displayTimeText: item.display_time_text || '',
  memberAmountText: `${item.member_amount_text || '0.00'}`,
  memberAmountDisplayText: formatDisplayAmount(item.member_amount_text || '0.00')
})

const fetchPackageList = async ({
  page = 1,
  pageSize = 10,
  keyword = '',
  district = '',
  category = '',
  latitude,
  longitude
} = {}) => {
  const payload = await get('/api/packages', {
    page,
    pageSize,
    keyword,
    district,
    category,
    latitude,
    longitude
  })
  const normalized = normalizeListPayload(payload)

  return {
    ...normalized,
    list: normalized.list.map(normalizePackageCard)
  }
}

const fetchPackageDetail = async packageId => normalizePackageDetail(await get(`/api/packages/${packageId}`))

const fetchPackageGroupDetail = async packageGroupId =>
  normalizePackageGroupDetail(
    await get(`/api/package-groups/${packageGroupId}`, {}, { showErrorToast: false })
  )

const createPackageStartOrder = async ({
  packageId,
  targetCount,
  weekday,
  hour,
  childNickname,
  childAge,
  parentMobile
}) =>
  post(
    '/api/package-orders/start',
    {
      packageId,
      targetCount,
      weekday,
      hour,
      childNickname,
      childAge,
      parentMobile
    },
    {
      showLoading: true,
      loadingText: '创建订单中',
      showErrorToast: false
    }
  )

const createPackageJoinOrder = async ({
  packageId,
  packageGroupId,
  childNickname,
  childAge,
  parentMobile
}) =>
  post(
    '/api/package-orders/join',
    {
      packageId,
      packageGroupId,
      childNickname,
      childAge,
      parentMobile
    },
    {
      showLoading: true,
      loadingText: '创建订单中',
      showErrorToast: false
    }
  )

const preparePayment = async ({ orderId }) =>
  post(
    '/api/payments/prepare',
    {
      orderId
    },
    {
      showLoading: true,
      loadingText: '拉起支付中',
      showErrorToast: false
    }
  )

const fetchPaymentStatus = async ({ orderId }) =>
  get(
    '/api/payments/status',
    {
      orderId
    },
    {
      showErrorToast: false
    }
  )

const closePaymentOrder = async ({ orderId }) =>
  post(
    '/api/payments/close',
    {
      orderId
    },
    {
      showLoading: true,
      loadingText: '关闭订单中',
      showErrorToast: false
    }
  )

const mockPaymentSuccess = async ({ orderId }) =>
  post(
    '/api/payments/mock-success',
    {
      orderId
    },
    {
      showLoading: true,
      loadingText: '支付中',
      showErrorToast: false
    }
  )

const fetchUserPackageGroupList = async ({ status = 'all', page = 1, pageSize = 10 }) => {
  const payload = await get(
    '/api/user/package-groups',
    {
      status,
      page,
      pageSize
    },
    {
      showErrorToast: false
    }
  )
  const normalized = normalizeListPayload(payload)

  return {
    ...normalized,
    list: normalized.list.map(normalizeUserPackageGroupListItem)
  }
}

module.exports = {
  START_HOUR_OPTIONS,
  WEEKDAY_LABELS,
  calculatePackageMemberAmountFen,
  closePaymentOrder,
  createPackageJoinOrder,
  createPackageStartOrder,
  fetchPackageDetail,
  fetchPackageGroupDetail,
  fetchPackageList,
  fetchPaymentStatus,
  fetchUserPackageGroupList,
  formatCountdownText,
  formatDisplayAmount,
  formatFenText,
  formatPackageLocationText,
  formatPackageDateTimeText,
  mockPaymentSuccess,
  normalizePackageDetail,
  normalizePackageGroupDetail,
  preparePayment
}
