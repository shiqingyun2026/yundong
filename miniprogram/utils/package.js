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
const DEFAULT_MEMBER_AVATAR = '/assets/member-default-avatar.jpg'
const STATUS_TEXT_MAP = {
  active: '进行中',
  success: '已成团',
  failed: '已失败',
  refund_pending: '退款中',
  refunded: '已退款',
  refund_failed: '退款失败'
}

const resolvePackageGroupProgressCopy = ({ minSuccessCount, targetCount, currentCount }) => {
  const normalizedTargetCount = Math.max(0, Number(targetCount) || 0)
  const normalizedMinSuccessCount = Math.max(0, Number(minSuccessCount) || normalizedTargetCount)
  const normalizedCurrentCount = Math.max(0, Number(currentCount) || 0)
  const successThreshold = normalizedMinSuccessCount || normalizedTargetCount
  const missingCount = Math.max(0, successThreshold - normalizedCurrentCount)
  const extraSeatCount = Math.max(0, normalizedTargetCount - normalizedCurrentCount)
  const reachedMinSuccess = successThreshold > 0 && normalizedCurrentCount >= successThreshold

  if (reachedMinSuccess && extraSeatCount > 0) {
    return {
      missingCount,
      extraSeatCount,
      reachedMinSuccess,
      missingText: `可加${extraSeatCount}人`,
      sharePrefix: `可加${extraSeatCount}人`
    }
  }

  return {
    missingCount,
    extraSeatCount,
    reachedMinSuccess,
    missingText: `还差${missingCount}人成团`,
    sharePrefix: `还差${missingCount}人`
  }
}

const buildPackageGroupShareTitle = ({ minSuccessCount, targetCount, currentCount, packageName }) => {
  const progressCopy = resolvePackageGroupProgressCopy({
    minSuccessCount,
    targetCount,
    currentCount
  })
  return `${progressCopy.sharePrefix}，来拼「${packageName || '邻动体适能课程'}」`
}

const buildPackageGroupTypeLabel = ({ minSuccessCount, targetCount }) => {
  const normalizedTargetCount = Math.max(0, Number(targetCount) || 0)
  const normalizedMinSuccessCount = Math.max(0, Number(minSuccessCount) || normalizedTargetCount)

  if (normalizedMinSuccessCount <= 1 && normalizedTargetCount <= 1) {
    return '1对1私教'
  }

  return normalizedMinSuccessCount && normalizedTargetCount && normalizedMinSuccessCount !== normalizedTargetCount
    ? `${normalizedMinSuccessCount}～${normalizedTargetCount}人团`
    : `${normalizedTargetCount}人团`
}

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
  const fallbackText = pickFirstNonEmptyString([source.location_text, source.locationText])
  const resolvedCity = city || fallbackCity

  const normalizedCommunity = extractLocationLeafPart(community, province)
  const formatted = dedupeOrderedParts([
    collapseLocationText(resolvedCity),
    collapseLocationText(district),
    normalizedCommunity
  ])

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

const normalizeRichTextImages = html => {
  const content = `${html || ''}`.trim()
  if (!content) {
    return ''
  }

  const normalizedImages = content.replace(/<img\b([^>]*)>/gi, (match, attrs = '') => {
    const normalizedAttrs = `${attrs}`.replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '')

    return `<img${normalizedAttrs} style="display:block;box-sizing:border-box;max-width:100%;width:100%;height:auto;margin:0 auto;" />`
  })

  return normalizedImages
    .split(/(<[^>]+>)/g)
    .map((segment, index, segments) => {
      if (!segment) {
        return ''
      }

      if (/^<[^>]+>$/.test(segment)) {
        return segment
      }

      if (!segment.trim()) {
        const previousIsTag = index > 0 && /^<[^>]+>$/.test(segments[index - 1])
        const nextIsTag = index < segments.length - 1 && /^<[^>]+>$/.test(segments[index + 1])

        if (previousIsTag || nextIsTag) {
          return ''
        }
      }

      return segment.replace(/\r?\n/g, '<br />')
    })
    .join('')
}

const normalizeGroupPriceConfig = value => {
  const items = Array.isArray(value) ? value : []

  return items
    .map(item => ({
      minSuccessCount: Number(item && (item.min_success_count || item.minSuccessCount || item.target_count || item.targetCount)) || 0,
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
  const classCount = Number(payload.class_count || payload.classCount) || 0
  const duration = Number(payload.class_duration_minutes || payload.classDurationMinutes) || 0

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
      minSuccessCount: (() => {
        const matched = groupPriceConfig.find(item => item.targetCount === count)
        return matched ? matched.minSuccessCount : count
      })(),
      memberAmountFen: calculatePackageMemberAmountFen({
        totalPriceFen,
        targetCount: count,
        groupPriceConfig
      })
    }))
    .filter(item => item.memberAmountFen > 0)
    .map(item => ({
      count: item.count,
      minSuccessCount: item.minSuccessCount,
      label: item.minSuccessCount && item.minSuccessCount !== item.count ? `${item.minSuccessCount}～${item.count}人团` : item.count === 1 ? '1对1私教' : `${item.count}人团`,
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
    return `剩余 ${days}天${hours}小时`
  }

  if (hours > 0) {
    return `剩余 ${hours}小时`
  }

  if (minutes > 0) {
    return `剩余 ${minutes}分钟`
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

const addMinutesToTimeText = (timeText, durationMinutes) => {
  const normalized = `${timeText || ''}`.trim()
  const matched = normalized.match(/^(\d{1,2}):(\d{2})$/)
  const minutesToAdd = Math.max(0, Number(durationMinutes) || 0)

  if (!matched || !minutesToAdd) {
    return normalized
  }

  const totalMinutes = Number(matched[1]) * 60 + Number(matched[2]) + minutesToAdd
  const hour = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
}

const formatFullScheduleDateTimeText = (value, durationMinutes = 0) => {
  const normalized = `${value || ''}`.trim()
  const weekdayMatched = normalized.match(
    /^(\d{4}-\d{2}-\d{2})\s+(周[一二三四五六日天])[\s—–-]*(\d{1,2}):(\d{2})(?:\s*[—–-]\s*(\d{1,2}:\d{2}))?$/
  )
  if (weekdayMatched) {
    const startTime = `${weekdayMatched[3].padStart(2, '0')}:${weekdayMatched[4]}`
    const endTime = weekdayMatched[5] || addMinutesToTimeText(startTime, durationMinutes)
    return endTime && endTime !== startTime
      ? `${weekdayMatched[1]} ${weekdayMatched[2]}${startTime} - ${endTime}`
      : `${weekdayMatched[1]} ${weekdayMatched[2]}${startTime}`
  }

  const matched = normalized.match(/^(\d{4}-\d{2}-\d{2})[\sT]+(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!matched) {
    return ''
  }

  const date = new Date(`${matched[1]}T12:00:00`)
  const weekday = WEEKDAY_LABELS[date.getDay() === 0 ? 7 : date.getDay()] || ''
  const startTime = `${matched[2].padStart(2, '0')}:${matched[3]}`
  const endTime = addMinutesToTimeText(startTime, durationMinutes)

  return endTime && endTime !== startTime
    ? `${matched[1]} ${weekday}${startTime} - ${endTime}`
    : `${matched[1]} ${weekday}${startTime}`
}

const normalizeScheduleDisplayText = (value, durationMinutes = 0) => {
  const formattedDateTime = formatFullScheduleDateTimeText(value, durationMinutes)
  if (formattedDateTime) {
    return formattedDateTime
  }

  return `${value || ''}`
    .trim()
    .replace(/(周[一二三四五六日天])\s+(\d{1,2}:\d{2})/g, '$1$2')
}

const formatPackageGroupScheduleList = (scheduleList, durationMinutes = 0) =>
  (scheduleList || []).map(item => ({
    ...item,
    display_text: normalizeScheduleDisplayText(
      item.display_text || item.displayText || item.class_time || item.classTime || formatPackageDateTimeText(item.class_time),
      durationMinutes
    )
  }))

const formatScheduleDisplayText = value => {
  const normalized = `${value || ''}`.trim()
  if (!normalized) {
    return ''
  }

  const matched = normalized.match(/^(每?周[一二三四五六日天])\s+(\d{1,2}:00)/)
  if (!matched) {
    return normalized.split(/[，,]/)[0] || normalized
  }

  return `${matched[1]} ${matched[2].padStart(5, '0')} 共5节课`
}

const resolveShareImageUrl = value => {
  const normalized = pickFirstNonEmptyString([value])
  if (!normalized || !/^https?:\/\//i.test(normalized)) {
    return normalized
  }

  try {
    const url = new URL(normalized)

    if (url.hostname.includes('images.unsplash.com')) {
      url.searchParams.set('auto', 'format')
      url.searchParams.set('fit', 'crop')
      url.searchParams.set('crop', 'center')
      url.searchParams.set('w', '760')
      url.searchParams.set('h', '608')
      url.searchParams.set('q', '80')
      return url.toString()
    }

    if (
      (url.hostname.includes('aliyuncs.com') || url.hostname.includes('oss-')) &&
      !url.searchParams.has('x-oss-process')
    ) {
      url.searchParams.set('x-oss-process', 'image/resize,m_fill,w_760,h_608/quality,q_90')
      return url.toString()
    }

    const isCosOriginHost = /\.cos\.[^.]+\.myqcloud\.com$/i.test(url.hostname)
    const isCosBackedCustomCdnCover = /\/course-cover\//i.test(url.pathname)

    if (isCosOriginHost || isCosBackedCustomCdnCover) {
      const shareCropRule = 'imageMogr2/crop/760x608/gravity/center/quality/90'

      if (!url.searchParams.has(shareCropRule)) {
        const currentSearch = url.search
        url.search = currentSearch ? `${currentSearch}&${shareCropRule}` : `?${shareCropRule}`
      }

      return url.toString()
    }

    return url.toString()
  } catch (error) {
    return normalized
  }
}

const normalizePackageCard = item => ({
  id: item.package_id || item.packageId || item.id || '',
  name: item.name || '',
  cover: item.cover || '',
  packageCategory: item.package_category || '体适能',
  ageRange: item.age_range || item.ageRange || '',
  classCount: Number(item.class_count || item.classCount) || 0,
  showLimitedTimeOfferTag: !!(item.show_limited_time_offer_tag || item.showLimitedTimeOfferTag),
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
  const minSuccessCount = Number(item.min_success_count) || targetCount
  const currentCount = Number(item.current_count) || 0
  const progressCopy = resolvePackageGroupProgressCopy({
    minSuccessCount,
    targetCount,
    currentCount
  })
  const canJoin = (item.status || 'active') === 'active' && currentCount < targetCount

  return {
    id: item.id || '',
    minSuccessCount,
    targetCount,
    groupTypeLabel: buildPackageGroupTypeLabel({
      minSuccessCount,
      targetCount
    }),
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
    ruleText: minSuccessCount && minSuccessCount !== targetCount
      ? `满${targetCount}人立即成团，截止满${minSuccessCount}人也成团`
      : `满${targetCount}人成团`,
    missingCount: progressCopy.missingCount,
    extraSeatCount: progressCopy.extraSeatCount,
    reachedMinSuccess: progressCopy.reachedMinSuccess,
    missingText: progressCopy.missingText,
    joinButtonText: canJoin
      ? progressCopy.reachedMinSuccess
        ? progressCopy.missingText
        : `还缺${progressCopy.missingCount}人，立即拼`
      : '已满员',
    canJoin
  }
}

const normalizePackageDetail = payload => ({
  id: payload.id || '',
  name: payload.name || '',
  cover: payload.cover || '',
  packageCategory: payload.package_category || payload.packageCategory || '体适能',
  classCount: Number(payload.class_count || payload.classCount) || 0,
  classDurationMinutes: Number(payload.class_duration_minutes || payload.classDurationMinutes) || 0,
  wechatShareCover: payload.wechat_share_cover || payload.wechatShareCover || '',
  images: Array.isArray(payload.images) && payload.images.length ? payload.images : payload.cover ? [payload.cover] : [],
  totalPriceFen: Number(payload.total_price_fen) || 0,
  totalPriceText: `${payload.total_price_text || formatFenText(payload.total_price_fen)}`,
  totalPriceDisplayText: formatDisplayAmount(payload.total_price_text || formatFenText(payload.total_price_fen)),
  ageRange: payload.age_range || payload.ageRange || '',
  groupPriceConfig: normalizeGroupPriceConfig(payload.group_price_config || payload.groupPriceConfig),
  supportedPeople: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => Number(item)).filter(Boolean) : [],
  supportedPeopleText: Array.isArray(payload.supported_people) ? payload.supported_people.map(item => `${item}人团`).join(' | ') : '',
  showLimitedTimeOfferTag: !!(payload.show_limited_time_offer_tag || payload.showLimitedTimeOfferTag),
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
  coachIntro: normalizeRichTextImages(payload.coach_intro || ''),
  coachCertificates: Array.isArray(payload.coach_certificates) ? payload.coach_certificates : [],
  description: normalizeRichTextImages(payload.description || ''),
  insuranceDesc: payload.insurance_desc || '',
  activeGroups: Array.isArray(payload.active_groups)
    ? payload.active_groups.map(normalizeActiveGroup).filter(group => group.remainingSeconds > 0)
    : []
})

const normalizePackageGroupDetail = payload => {
  const packagePayload = payload.package || {}
  const classDurationMinutes = Number(packagePayload.class_duration_minutes || packagePayload.classDurationMinutes) || 0
  const scheduleList = formatPackageGroupScheduleList(payload.schedule_list, classDurationMinutes)
  const targetCount = Number(payload.target_count) || 0
  const minSuccessCount = Number(payload.min_success_count) || targetCount
  const currentCount = Number(payload.current_count) || 0
  const progressCopy = resolvePackageGroupProgressCopy({
    minSuccessCount,
    targetCount,
    currentCount
  })
  const classCount = Number(packagePayload.class_count || packagePayload.classCount) || scheduleList.length || 0
  const hasFirstClassTime = !!payload.first_class_time
  const rawScheduleMode = payload.schedule_mode || 'pending'
  const scheduleMode = rawScheduleMode === 'locked' && !hasFirstClassTime ? 'pending' : rawScheduleMode
  const rawScheduleText = `${payload.schedule_text || ''}`.trim()
  const scheduleText = /^首课时间\s*，/.test(rawScheduleText) ? '' : rawScheduleText
  const packageFeaturePayload = {
    ...packagePayload,
    class_count: classCount,
    classDurationMinutes
  }

  return {
    id: payload.id || '',
    status: payload.status || 'active',
    packageInfo: {
      id: payload.package && payload.package.id ? payload.package.id : '',
      name: payload.package && payload.package.name ? payload.package.name : '',
      cover: payload.package && payload.package.cover ? payload.package.cover : '',
      wechatShareCover: payload.package && payload.package.wechat_share_cover ? payload.package.wechat_share_cover : '',
      classCount,
      classDurationMinutes,
      ageRange: payload.package && payload.package.age_range ? payload.package.age_range : '',
      showLimitedTimeOfferTag: !!(payload.package && payload.package.show_limited_time_offer_tag),
      featureTags: payload.package ? buildPackageFeatureTags(packageFeaturePayload) : [],
      supportedGroupPriceList: payload.package ? buildSupportedGroupPriceList(payload.package) : [],
      description: normalizeRichTextImages(payload.package && payload.package.description ? payload.package.description : ''),
      coachName: payload.package && payload.package.coach_name ? payload.package.coach_name : '',
      coachIntro: normalizeRichTextImages(payload.package && payload.package.coach_intro ? payload.package.coach_intro : ''),
      coachCertificates:
        payload.package && Array.isArray(payload.package.coach_certificates)
          ? payload.package.coach_certificates
          : [],
      locationText: payload.package ? formatPackageLocationText(payload.package) : '',
      locationDisplayText: payload.package ? formatPackageLocationText(payload.package) : ''
    },
    targetCount,
    minSuccessCount,
    currentCount,
    missingCount: progressCopy.missingCount,
    extraSeatCount: progressCopy.extraSeatCount,
    reachedMinSuccess: progressCopy.reachedMinSuccess,
    missingText: progressCopy.missingText,
    groupRuleText: minSuccessCount && minSuccessCount !== targetCount
      ? `满${targetCount}人立即成团，截止满${minSuccessCount}人也成团`
      : `满${targetCount}人成团`,
    remainingSeconds: Math.max(0, Number(payload.remaining_seconds) || 0),
    remainingText: formatCountdownText(payload.remaining_seconds),
    remainingPlainText: formatCountdownPlainText(payload.remaining_seconds),
    memberAmountFen: Number(payload.member_amount_fen) || 0,
    memberAmountText: `${payload.member_amount_text || formatFenText(payload.member_amount_fen)}`,
    memberAmountDisplayText: formatDisplayAmount(payload.member_amount_text || formatFenText(payload.member_amount_fen)),
    scheduleMode,
    scheduleText,
    scheduleDisplayText: formatScheduleDisplayText(scheduleText),
    firstClassTime: payload.first_class_time || '',
    firstClassTimeText: payload.first_class_time ? formatPackageDateTimeText(payload.first_class_time) : '',
    scheduleList,
    childNickname: payload.child_nickname || '',
    childAge: payload.child_age === null || payload.child_age === undefined ? null : Number(payload.child_age) || 0,
    members: Array.isArray(payload.members)
      ? payload.members.map(member => ({
          ...member,
          orderId: member.order_id || member.orderId || '',
          avatar_url: member.avatar_url || DEFAULT_MEMBER_AVATAR,
          childAge: member.child_age === null || member.child_age === undefined ? null : Number(member.child_age) || 0,
          displayNameMasked: member.display_name_masked || '',
          displayName: member.display_name || member.child_nickname || member.nickname || '孩子昵称未填写',
          displayText: [
            member.display_name_masked || member.display_name || member.child_nickname || member.nickname || '孩子昵称未填写',
            member.child_age === null || member.child_age === undefined || !Number(member.child_age)
              ? ''
              : `${Number(member.child_age)}岁`
          ].filter(Boolean).join('   ')
        }))
      : [],
    userJoined: !!payload.user_joined,
    progressPercent:
      Number(payload.target_count) > 0
        ? `${Math.min(100, Math.round((Number(payload.current_count) / Number(payload.target_count)) * 100))}%`
        : '0%'
  }
}

const normalizeUserPackageGroupListItem = item => {
  const status = item.status || 'active'
  const currentCount = Number(item.current_count) || 0
  const minSuccessCount = Number(item.min_success_count) || Number(item.target_count) || 0
  const targetCount = Number(item.target_count) || 0
  const progressCopy = resolvePackageGroupProgressCopy({
    minSuccessCount,
    targetCount,
    currentCount
  })

  return {
    orderId: item.order_id || item.orderId || '',
    packageGroupId: item.package_group_id || '',
    packageId: item.package_id || '',
    packageName: item.package_name || '',
    childNicknameMasked: item.child_nickname_masked || '',
    childNickname: item.child_nickname || item.childNickname || '',
    childAge:
      item.child_age === null || item.child_age === undefined
        ? null
        : Number(item.child_age) || 0,
    status,
    groupStatus: item.group_status || status,
    orderStatus: item.order_status || '',
    displayStatusText:
      status === 'active' && progressCopy.reachedMinSuccess && progressCopy.extraSeatCount > 0
        ? progressCopy.missingText
        : STATUS_TEXT_MAP[status] || '进行中',
    canOpenDetail: item.can_open_detail !== false,
    locationText: formatPackageLocationText(item),
    currentCount,
    minSuccessCount,
    targetCount,
    missingCount: progressCopy.missingCount,
    firstClassTime: item.first_class_time || '',
    displayTimeText: item.display_time_text || '',
    memberAmountText: `${item.member_amount_text || '0.00'}`,
    memberAmountDisplayText: formatDisplayAmount(item.member_amount_text || '0.00')
  }
}

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

const fetchPackageDetail = async (packageId, options = {}) =>
  normalizePackageDetail(await get(`/api/packages/${packageId}`, {}, options))

const fetchPackageGroupDetail = async packageGroupId =>
  normalizePackageGroupDetail(
    await get(`/api/package-groups/${packageGroupId}`, {}, { showErrorToast: false })
  )

const createPackageStartOrder = async ({
  packageId,
  targetCount,
  scheduleType,
  scheduleDate,
  scheduleDays,
  scheduleTime,
  scheduleList,
  childNickname,
  childAge,
  parentMobile
}) =>
  post(
    '/api/package-orders/start',
    {
      packageId,
      targetCount,
      scheduleType,
      scheduleDate,
      scheduleDays,
      scheduleTime,
      scheduleList,
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

const prepareCloudPayment = ({ orderId, userId = '' }) =>
  new Promise((resolve, reject) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject(new Error('当前微信版本不支持云支付'))
      return
    }

    wx.cloud.callFunction({
      name: 'wechat-pay',
      data: {
        type: 'prepare',
        orderId,
        userId
      },
      success(result) {
        const payload = (result && result.result) || {}
        if (payload && Number(payload.code) !== 0) {
          reject(new Error(payload.message || '支付参数生成失败'))
          return
        }

        const data = payload && (payload.data || payload)
        if (!data || !data.payment) {
          const cloudPayResult = data && data.cloudPayResult
          reject(
            new Error(
              (cloudPayResult &&
                (cloudPayResult.returnMsg ||
                  cloudPayResult.errCodeDes ||
                  cloudPayResult.errMsg ||
                  cloudPayResult.resultCode ||
                  cloudPayResult.returnCode)) ||
                '支付参数生成失败'
            )
          )
          return
        }
        resolve(data)
      },
      fail(error) {
        reject(error)
      }
    })
  })

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
  formatPackageGroupScheduleList,
  formatPackageLocationText,
  formatPackageDateTimeText,
  buildPackageGroupShareTitle,
  mockPaymentSuccess,
  normalizePackageDetail,
  normalizePackageGroupDetail,
  normalizeUserPackageGroupListItem,
  prepareCloudPayment,
  preparePayment,
  resolvePackageGroupProgressCopy,
  resolveShareImageUrl
}
