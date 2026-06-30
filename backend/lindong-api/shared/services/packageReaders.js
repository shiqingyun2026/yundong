const { env } = require('../../config/env')
const { coursePackagesRepository, ordersRepository, packageGroupsRepository, usersRepository } = require('../../repositories')
const { calculatePackageMemberAmountFen } = require('../domain/packageGroupRules')
const { createPackageServiceError } = require('./packageServiceError')
const {
  buildPackageLessonSchedule,
  formatPackageDateTime,
  formatPendingPackageScheduleText,
  formatScheduleTextWithLockNote
} = require('./packageSchedule')
const { cleanupExpiredPackageGroups } = require('./packageGroupStore')
const { signCosImageList, signCosPublicUrl, signCosUrlsInText } = require('./cosSignedUrl')
const { parseShanghaiDate } = require('../utils/dateTime')

const formatFenText = amountFen => (Number(amountFen || 0) / 100).toFixed(2)

const DEFAULT_MEMBER_AVATAR = '/assets/member-default-avatar.jpg'

const maskStudentNickname = value => {
  const normalized = `${value === null || value === undefined ? '' : value}`.trim()
  if (!normalized) {
    return ''
  }

  const chars = Array.from(normalized)
  if (chars.length <= 1) {
    return '*'
  }

  return `${chars.slice(0, -1).join('')}*`
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

const formatMiniProgramLocationText = pkg => {
  const source = pkg || {}
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

const buildLocationText = pkg => formatMiniProgramLocationText(pkg)

const buildMiniProgramLocationText = pkg => formatMiniProgramLocationText(pkg)

const buildAdminLocationText = pkg => [pkg.location_district, pkg.location_community, pkg.location_detail].filter(Boolean).join(' / ')

const resolveLowestGroupPriceFen = pkg => {
  const priceList = (pkg.group_price_config || [])
    .map(item => Number(item && item.price_fen))
    .filter(price => Number.isFinite(price) && price > 0)

  if (priceList.length) {
    return Math.min(...priceList)
  }

  const supportedPeople = (pkg.supported_people || []).map(item => Number(item)).filter(Boolean)
  const maxSupportedPeople = supportedPeople.length ? Math.max(...supportedPeople) : 0

  return calculatePackageMemberAmountFen({
    totalPrice: pkg.total_price,
    targetCount: maxSupportedPeople,
    groupPriceConfig: pkg.group_price_config
  })
}

const EARTH_RADIUS_METERS = 6371000

const toRadians = degrees => (Number(degrees) * Math.PI) / 180

const calculateDistanceMeters = ({ latitude, longitude }, target) => {
  const fromLat = Number(latitude)
  const fromLng = Number(longitude)
  const toLat = Number(target && target.latitude)
  const toLng = Number(target && target.longitude)

  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return null
  }

  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const lat1 = toRadians(fromLat)
  const lat2 = toRadians(toLat)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)))
}

const ensureMySqlMode = () => {
  if (!env.useMySqlRepositories) {
    throw createPackageServiceError(501, 5000, 'package group is only supported in mysql mode')
  }
}

const resolvePackageStatus = ({ status, publishTime, unpublishTime, now = new Date() }) => {
  if (Number(status) === 0) {
    return 'inactive'
  }

  if (unpublishTime) {
    const unpublishDate = parseShanghaiDate(unpublishTime)
    if (unpublishDate && unpublishDate.getTime() <= now.getTime()) {
      return 'inactive'
    }
  }

  if (!publishTime) {
    return 'active'
  }

  const publishDate = parseShanghaiDate(publishTime)
  if (!publishDate) {
    return 'active'
  }

  return publishDate.getTime() > now.getTime() ? 'pending' : 'active'
}

const fetchUsersByIds = async userIds => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return {}
  }

  const users = await usersRepository.listUsersByIds(ids)
  return (users || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})
}

const logMiniProgramPackageLocationDebug = packages => {
  const list = Array.isArray(packages) ? packages : []
  if (!list.length) {
    return
  }

  console.info(
    '[packageReaders] home package location debug',
    list.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      location_province: item.location_province || '',
      location_city: item.location_city || '',
      location_district: item.location_district || '',
      location_community: item.location_community || '',
      location_detail: item.location_detail || '',
      location_text: buildMiniProgramLocationText(item)
    }))
  )
}

const fetchMiniProgramPackageList = async ({
  page = 1,
  pageSize = 10,
  keyword = '',
  district = '',
  category = '',
  latitude = null,
  longitude = null,
  now = new Date()
}) => {
  ensureMySqlMode()

  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const packages = await coursePackagesRepository.listPackages({
    keyword,
    category,
    district,
    status: 1
  })
  const visiblePackages = packages.filter(item => resolvePackageStatus({
    status: item.status,
    publishTime: item.publish_time,
    unpublishTime: item.unpublish_time,
    now
  }) === 'active')

  const packageIds = visiblePackages.map(item => item.id).filter(Boolean)
  await cleanupExpiredPackageGroups({
    packageIds,
    now
  })

  const activeGroups = packageIds.length
    ? await packageGroupsRepository.listPackageGroups({
        packageIds,
        statuses: ['active'],
        afterDeadline: now
      })
    : []

  const activeGroupCountMap = (activeGroups || []).reduce((result, item) => {
    result[item.package_id] = (result[item.package_id] || 0) + 1
    return result
  }, {})

  const sortedPackages = visiblePackages
    .map(item => {
      const distanceMeters = calculateDistanceMeters(
        {
          latitude,
          longitude
        },
        item
      )

      return {
        ...item,
        distance_meters: distanceMeters
      }
    })
    .sort((left, right) => {
      const leftDistance = Number.isFinite(left.distance_meters) ? left.distance_meters : Number.MAX_SAFE_INTEGER
      const rightDistance = Number.isFinite(right.distance_meters) ? right.distance_meters : Number.MAX_SAFE_INTEGER

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      const leftMinPriceFen = resolveLowestGroupPriceFen(left)
      const rightMinPriceFen = resolveLowestGroupPriceFen(right)

      if (leftMinPriceFen !== rightMinPriceFen) {
        return leftMinPriceFen - rightMinPriceFen
      }

      return (parseShanghaiDate(right.created_at || 0)?.getTime() || 0) - (parseShanghaiDate(left.created_at || 0)?.getTime() || 0)
    })

  const from = (safePage - 1) * safePageSize
  const pagedPackages = sortedPackages.slice(from, from + safePageSize)
  logMiniProgramPackageLocationDebug(pagedPackages)
  const list = pagedPackages.map(item => {
    const maxSupportedPeople = Math.max(...(item.supported_people || [0]))
    const minMemberAmountFen = resolveLowestGroupPriceFen(item)

    return {
    id: item.id,
    name: item.name,
    cover: signCosPublicUrl(item.cover),
    wechat_share_cover: signCosPublicUrl(item.wechat_share_cover),
    package_category: item.package_category || '体适能',
      age_range: item.age_range || '',
      class_count: Number(item.class_count) || 0,
      class_duration_minutes: Number(item.class_duration_minutes) || 0,
      show_limited_time_offer_tag: !!item.show_limited_time_offer_tag,
      group_price_config: item.group_price_config || [],
      max_supported_people: maxSupportedPeople,
      min_member_amount_fen: minMemberAmountFen,
      min_member_amount_text: formatFenText(minMemberAmountFen),
      location_city: item.location_city,
      location_district: item.location_district,
      location_community: item.location_community,
      location_detail: item.location_detail,
      active_group_count: Number(activeGroupCountMap[item.id]) || 0,
      distance_meters: Number.isFinite(item.distance_meters) ? item.distance_meters : null,
      created_at: item.created_at || null
    }
  })

  return {
    list,
    page: safePage,
    pageSize: safePageSize,
    total: sortedPackages.length
  }
}

const fetchMiniProgramPackageDetail = async ({ packageId, now = new Date() }) => {
  ensureMySqlMode()

  const pkg = await coursePackagesRepository.findPackageById(packageId)
  if (
    !pkg ||
    resolvePackageStatus({
      status: pkg.status,
      publishTime: pkg.publish_time,
      unpublishTime: pkg.unpublish_time,
      now
    }) !== 'active'
  ) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }

  await cleanupExpiredPackageGroups({
    packageId,
    now
  })

  const activeGroups = await packageGroupsRepository.listPackageGroups({
    packageId,
    statuses: ['active'],
    afterDeadline: now
  })

  return {
    id: pkg.id,
    name: pkg.name,
    cover: signCosPublicUrl(pkg.cover),
    wechat_share_cover: signCosPublicUrl(pkg.wechat_share_cover),
    images: signCosImageList((pkg.images && pkg.images.length ? pkg.images : pkg.cover ? [pkg.cover] : []) || []),
    total_price_fen: Number(pkg.total_price) || 0,
    total_price_text: formatFenText(pkg.total_price),
    package_category: pkg.package_category || '体适能',
    age_range: pkg.age_range || '',
    class_count: Number(pkg.class_count) || 0,
    class_duration_minutes: Number(pkg.class_duration_minutes) || 0,
    show_limited_time_offer_tag: !!pkg.show_limited_time_offer_tag,
    group_price_config: pkg.group_price_config || [],
    supported_people: pkg.supported_people || [],
    location_city: pkg.location_city,
    location_district: pkg.location_district,
    location_community: pkg.location_community,
    location_detail: pkg.location_detail,
    coach_name: pkg.coach_name,
    coach_intro: signCosUrlsInText(pkg.coach_intro || ''),
    coach_certificates: signCosImageList(pkg.coach_certificates || []),
    description: signCosUrlsInText(pkg.description || ''),
    insurance_desc: '课程期间统一赠送基础运动意外险，具体保障范围以投保说明为准。',
    active_groups: (activeGroups || [])
      .filter(group => {
        const deadline = parseShanghaiDate(group && group.deadline)
        return (
          group &&
          group.status === 'active' &&
          Number(group.current_count) > 0 &&
          !!deadline &&
          deadline.getTime() > now.getTime()
        )
      })
      .sort((left, right) => {
        const leftDeadline = parseShanghaiDate(left.deadline)
        const rightDeadline = parseShanghaiDate(right.deadline)
        return (leftDeadline ? leftDeadline.getTime() : 0) - (rightDeadline ? rightDeadline.getTime() : 0)
      })
      .map(group => {
        const deadline = parseShanghaiDate(group.deadline)
        const memberAmountFen = calculatePackageMemberAmountFen({
          totalPrice: pkg.total_price,
          targetCount: group.target_count,
          groupPriceConfig: pkg.group_price_config
        })

        return {
          id: group.id,
          min_success_count: Number(group.min_success_count) || Number(group.target_count) || 0,
          target_count: Number(group.target_count) || 0,
          current_count: Number(group.current_count) || 0,
          status: group.status,
          remaining_seconds: deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000)) : 0,
          member_amount_fen: memberAmountFen,
          member_amount_text: formatFenText(memberAmountFen),
          schedule_text: formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour,
            scheduleConfig: group.schedule_config,
            classCount: Number(pkg.class_count) || 0
          })
        }
      })
  }
}

const fetchMiniProgramPackageGroupDetail = async ({ packageGroupId, userId = '', now = new Date() }) => {
  ensureMySqlMode()

  const group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  if (!group) {
    throw createPackageServiceError(404, 2002, '拼团不存在')
  }

  await cleanupExpiredPackageGroups({
    packageId: group.package_id,
    now
  })

  const latestGroup = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  if (!latestGroup) {
    throw createPackageServiceError(404, 2002, '拼团不存在')
  }

  const pkg = await coursePackagesRepository.findPackageById(latestGroup.package_id)
  if (!pkg) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }

  if (userId) {
    const viewerOrders = await ordersRepository.listOrders({
      userId,
      orderType: 2,
      packageGroupId
    })

    if ((viewerOrders || []).some(item => ['refund_pending', 'refunded', 'refund_failed'].includes(item.status))) {
      throw createPackageServiceError(403, 2006, '退款订单不可查看拼团详情')
    }
  }

  const successOrders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId,
    status: 'success'
  })
  const usersById = await fetchUsersByIds(successOrders.map(item => item.user_id))
  const memberAmountFen = calculatePackageMemberAmountFen({
    totalPrice: pkg.total_price,
    targetCount: latestGroup.target_count,
    groupPriceConfig: pkg.group_price_config
  })
  const scheduleConfig = latestGroup.schedule_config || null
  const classCount = Math.max(1, Number(pkg.class_count) || 0)
  const scheduleList = buildPackageLessonSchedule({
    scheduleConfig,
    firstClassTime: latestGroup.first_class_time,
    weeks: classCount
  })
  const hasLockedFirstClassTime = !!latestGroup.first_class_time
  const scheduleMode =
    hasLockedFirstClassTime && scheduleConfig && scheduleConfig.schedule_type === 'single'
      ? 'single_session'
      : hasLockedFirstClassTime
        ? 'locked'
        : 'pending'
  const userJoined = !!(userId && successOrders.some(item => item.user_id === userId))
  const leaderOrder = successOrders.find(item => item.package_action === 'start') || successOrders[0] || null

  return {
    id: latestGroup.id,
    status: latestGroup.status,
    package: {
      id: pkg.id,
      name: pkg.name,
      cover: signCosPublicUrl(pkg.cover),
      wechat_share_cover: signCosPublicUrl(pkg.wechat_share_cover),
      age_range: pkg.age_range || '',
      coach_name: pkg.coach_name || '',
      coach_intro: signCosUrlsInText(pkg.coach_intro || ''),
      coach_certificates: signCosImageList(pkg.coach_certificates || []),
      description: signCosUrlsInText(pkg.description || ''),
      location_city: pkg.location_city || '',
      location_district: pkg.location_district || '',
      location_community: pkg.location_community || '',
      location_detail: pkg.location_detail || '',
      location_text: buildMiniProgramLocationText(pkg)
    },
    target_count: Number(latestGroup.target_count) || 0,
    min_success_count: Number(latestGroup.min_success_count) || Number(latestGroup.target_count) || 0,
    current_count: Number(latestGroup.current_count) || 0,
    remaining_seconds:
      latestGroup.status === 'active' && parseShanghaiDate(latestGroup.deadline)
        ? Math.max(0, Math.floor((parseShanghaiDate(latestGroup.deadline).getTime() - now.getTime()) / 1000))
        : 0,
    member_amount_fen: memberAmountFen,
    member_amount_text: formatFenText(memberAmountFen),
    schedule_mode: scheduleMode,
    schedule_text:
      scheduleMode === 'single_session'
        ? latestGroup.first_class_time
          ? `上课时间 ${formatPackageDateTime(latestGroup.first_class_time)}`
          : '上课时间待定'
        : scheduleMode === 'locked'
          ? `首课时间 ${formatPackageDateTime(latestGroup.first_class_time)}，共${classCount}次`
          : formatScheduleTextWithLockNote({
              weekday: latestGroup.weekday,
              hour: latestGroup.hour,
              scheduleConfig,
              classCount
            }),
    first_class_time: latestGroup.first_class_time ? formatPackageDateTime(latestGroup.first_class_time) : null,
    schedule_list: scheduleList,
    members: successOrders.map(order => {
      const childNickname =
        (order.package_context && order.package_context.child_nickname) ||
        (usersById[order.user_id] && usersById[order.user_id].nickname) ||
        '微信用户'

      return {
        order_id: order.id,
        user_id: order.user_id,
        nickname: childNickname,
        display_name_masked: maskStudentNickname(childNickname) || '微信用户',
        child_nickname: (order.package_context && order.package_context.child_nickname) || '',
        child_age:
          order.package_context && order.package_context.child_age !== undefined && order.package_context.child_age !== null
            ? Number(order.package_context.child_age) || 0
            : null,
        avatar_url: DEFAULT_MEMBER_AVATAR
      }
    }),
    child_nickname:
      (leaderOrder &&
        leaderOrder.package_context &&
        leaderOrder.package_context.child_nickname) ||
      '',
    child_age:
      (leaderOrder &&
        leaderOrder.package_context &&
        leaderOrder.package_context.child_age) ||
      null,
    user_joined: userJoined
  }
}

const fetchMiniProgramUserPackageGroupList = async ({ userId, status = 'all', page = 1, pageSize = 10, now = new Date() }) => {
  ensureMySqlMode()

  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const initialOrders = await ordersRepository.listOrders({
    userId,
    orderType: 2,
    statuses: ['success', 'refund_pending', 'refunded', 'refund_failed']
  })
  const packageGroupIds = [...new Set((initialOrders || []).map(item => item.package_group_id).filter(Boolean))]
  const packageGroups = await Promise.all(packageGroupIds.map(id => packageGroupsRepository.findPackageGroupById(id)))
  const groupById = packageGroups.filter(Boolean).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  const packageIds = [...new Set(packageGroups.map(item => item && item.package_id).filter(Boolean))]
  await cleanupExpiredPackageGroups({
    packageIds,
    now
  })

  const orders = await ordersRepository.listOrders({
    userId,
    orderType: 2,
    statuses: ['success', 'refund_pending', 'refunded', 'refund_failed']
  })
  const refreshedGroups = await Promise.all(packageGroupIds.map(id => packageGroupsRepository.findPackageGroupById(id)))
  const refreshedGroupById = refreshedGroups.filter(Boolean).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})
  const refreshedPackageIds = [...new Set(refreshedGroups.map(item => item && item.package_id).filter(Boolean))]
  const packages = await coursePackagesRepository.findPackagesByIds(refreshedPackageIds)
  const packageById = (packages || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  const normalizedStatus = ['active', 'success', 'failed', 'refund_pending', 'refunded', 'refund_failed'].includes(status) ? status : 'all'
  const listSource = (orders || [])
    .filter(order => refreshedGroupById[order.package_group_id])
    .filter(order => {
      if (normalizedStatus === 'all') {
        return true
      }

      const group = refreshedGroupById[order.package_group_id]
      const displayStatus = ['refund_pending', 'refunded', 'refund_failed'].includes(order.status)
        ? order.status
        : group.status

      if (normalizedStatus === 'failed') {
        return ['failed', 'refund_pending', 'refunded', 'refund_failed'].includes(displayStatus)
      }

      return displayStatus === normalizedStatus
    })
    .sort(
      (left, right) =>
        (parseShanghaiDate(right.created_at)?.getTime() || 0) -
        (parseShanghaiDate(left.created_at)?.getTime() || 0)
    )

  const from = (safePage - 1) * safePageSize
  const list = listSource.slice(from, from + safePageSize).map(order => {
    const group = refreshedGroupById[order.package_group_id]
    const pkg = packageById[group.package_id]
    const memberAmountFen = calculatePackageMemberAmountFen({
      totalPrice: pkg ? pkg.total_price : 0,
      targetCount: group.target_count,
      groupPriceConfig: pkg ? pkg.group_price_config : []
    })
    const displayStatus = ['refund_pending', 'refunded', 'refund_failed'].includes(order.status)
      ? order.status
      : group.status
    const canOpenDetail = !['refund_pending', 'refunded', 'refund_failed'].includes(order.status)

    return {
      order_id: order.id,
      package_group_id: group.id,
      package_id: group.package_id,
      package_name: pkg ? pkg.name : '',
      child_nickname:
        (order.package_context && order.package_context.child_nickname) || '',
      child_nickname_masked: maskStudentNickname(
        (order.package_context && order.package_context.child_nickname) || ''
      ),
      child_age:
        order.package_context && order.package_context.child_age !== undefined && order.package_context.child_age !== null
          ? Number(order.package_context.child_age) || 0
          : null,
      age_range: pkg ? pkg.age_range || '' : '',
      status: displayStatus,
      order_status: order.status || '',
      group_status: group.status,
      can_open_detail: canOpenDetail,
      location_city: pkg ? pkg.location_city || '' : '',
      location_district: pkg ? pkg.location_district || '' : '',
      location_community: pkg ? pkg.location_community || '' : '',
      location_detail: pkg ? pkg.location_detail || '' : '',
      location_text: pkg ? buildLocationText(pkg) : '',
      current_count: Number(group.current_count) || 0,
      min_success_count: Number(group.min_success_count) || Number(group.target_count) || 0,
      target_count: Number(group.target_count) || 0,
      missing_count: Math.max(
        0,
        (Number(group.min_success_count) || Number(group.target_count) || 0) - (Number(group.current_count) || 0)
      ),
      first_class_time: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
      display_time_text: group.first_class_time
        ? formatPackageDateTime(group.first_class_time)
        : formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour,
            scheduleConfig: group.schedule_config,
            classCount: Number(pkg && pkg.class_count) || 0
          }),
      created_at: order.created_at || null,
      member_amount_text: formatFenText(memberAmountFen)
    }
  })

  return {
    list,
    page: safePage,
    pageSize: safePageSize,
    total: listSource.length
  }
}

module.exports = {
  buildAdminLocationText,
  buildLocationText,
  buildMiniProgramLocationText,
  fetchMiniProgramPackageDetail,
  fetchMiniProgramPackageGroupDetail,
  fetchMiniProgramPackageList,
  fetchMiniProgramUserPackageGroupList,
  formatFenText
}
