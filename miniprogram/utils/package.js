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
  id: item.id || '',
  name: item.name || '',
  cover: item.cover || '',
  packageCategory: item.package_category || '体适能',
  maxSupportedPeople: Number(item.max_supported_people) || 0,
  minMemberAmountFen: Number(item.min_member_amount_fen) || 0,
  minMemberAmountText: `${item.min_member_amount_text || formatFenText(item.min_member_amount_fen)}`,
  locationDistrict: item.location_district || '',
  locationCommunity: item.location_community || '',
  locationDetail: item.location_detail || '',
  locationText: [item.location_community, item.location_detail].filter(Boolean).join(' '),
  activeGroupCount: Number(item.active_group_count) || 0,
  groupCountText: Number(item.active_group_count) > 0 ? `${item.active_group_count} 个团进行中` : '支持随时开团',
  distanceMeters: Number.isFinite(Number(item.distance_meters)) ? Number(item.distance_meters) : null,
  createdAt: item.created_at || ''
})

const normalizeActiveGroup = item => ({
  id: item.id || '',
  targetCount: Number(item.target_count) || 0,
  currentCount: Number(item.current_count) || 0,
  status: item.status || 'active',
  remainingSeconds: Math.max(0, Number(item.remaining_seconds) || 0),
  remainingText: formatCountdownText(item.remaining_seconds),
  memberAmountFen: Number(item.member_amount_fen) || 0,
  memberAmountText: `${item.member_amount_text || formatFenText(item.member_amount_fen)}`,
  scheduleText: item.schedule_text || '时间待定',
  progressText: `${Number(item.current_count) || 0}/${Number(item.target_count) || 0}`,
  canJoin: (item.status || 'active') === 'active' && Number(item.current_count) < Number(item.target_count)
})

const normalizePackageDetail = payload => ({
  id: payload.id || '',
  name: payload.name || '',
  cover: payload.cover || '',
  images: Array.isArray(payload.images) && payload.images.length ? payload.images : payload.cover ? [payload.cover] : [],
  totalPriceFen: Number(payload.total_price_fen) || 0,
  totalPriceText: `${payload.total_price_text || formatFenText(payload.total_price_fen)}`,
  supportedPeople: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => Number(item)).filter(Boolean) : [],
  supportedPeopleText: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => `${item}人团`).join(' | ') : '',
  locationDistrict: payload.location_district || '',
  locationCommunity: payload.location_community || '',
  locationDetail: payload.location_detail || '',
  locationText: [payload.location_district, payload.location_community, payload.location_detail].filter(Boolean).join(' / '),
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
    locationText: payload.package && payload.package.location_text ? payload.package.location_text : '',
    coachName: payload.package && payload.package.coach_name ? payload.package.coach_name : ''
  },
  targetCount: Number(payload.target_count) || 0,
  currentCount: Number(payload.current_count) || 0,
  remainingSeconds: Math.max(0, Number(payload.remaining_seconds) || 0),
  remainingText: formatCountdownText(payload.remaining_seconds),
  memberAmountFen: Number(payload.member_amount_fen) || 0,
  memberAmountText: `${payload.member_amount_text || formatFenText(payload.member_amount_fen)}`,
  scheduleMode: payload.schedule_mode || 'pending',
  scheduleText: payload.schedule_text || '',
  firstClassTime: payload.first_class_time || '',
  firstClassTimeText: payload.first_class_time ? formatPackageDateTimeText(payload.first_class_time) : '',
  scheduleList: formatScheduleList(payload.schedule_list),
  members: Array.isArray(payload.members) ? payload.members : [],
  userJoined: !!payload.user_joined,
  progressPercent:
    Number(payload.target_count) > 0
      ? `${Math.min(100, Math.round((Number(payload.current_count) / Number(payload.target_count)) * 100))}%`
      : '0%'
})

const normalizeUserPackageGroupListItem = item => ({
  packageGroupId: item.package_group_id || '',
  packageId: item.package_id || '',
  packageName: item.package_name || '',
  status: item.status || 'active',
  locationText: item.location_text || '',
  firstClassTime: item.first_class_time || '',
  displayTimeText: item.display_time_text || '',
  memberAmountText: `${item.member_amount_text || '0.00'}`
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

const createPackageStartOrder = async ({ packageId, targetCount, weekday, hour }) =>
  post(
    '/api/package-orders/start',
    {
      packageId,
      targetCount,
      weekday,
      hour
    },
    {
      showLoading: true,
      loadingText: '创建订单中',
      showErrorToast: false
    }
  )

const createPackageJoinOrder = async ({ packageId, packageGroupId }) =>
  post(
    '/api/package-orders/join',
    {
      packageId,
      packageGroupId
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
  createPackageJoinOrder,
  createPackageStartOrder,
  fetchPackageDetail,
  fetchPackageGroupDetail,
  fetchPackageList,
  fetchUserPackageGroupList,
  formatCountdownText,
  formatFenText,
  formatPackageDateTimeText,
  mockPaymentSuccess,
  normalizePackageDetail,
  normalizePackageGroupDetail,
  preparePayment
}
