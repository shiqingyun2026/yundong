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

const formatFenText = amountFen => (Number(amountFen || 0) / 100).toFixed(2)

const buildLocationText = pkg => [pkg.location_community, pkg.location_detail].filter(Boolean).join(' ')

const buildAdminLocationText = pkg => [pkg.location_district, pkg.location_community, pkg.location_detail].filter(Boolean).join(' / ')

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
    const unpublishDate = new Date(unpublishTime)
    if (!Number.isNaN(unpublishDate.getTime()) && unpublishDate.getTime() <= now.getTime()) {
      return 'inactive'
    }
  }

  if (!publishTime) {
    return 'active'
  }

  const publishDate = new Date(publishTime)
  if (Number.isNaN(publishDate.getTime())) {
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

      return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
    })

  const from = (safePage - 1) * safePageSize
  const list = sortedPackages.slice(from, from + safePageSize).map(item => {
    const maxGroupConfig = [...(item.group_price_config || [])].sort((left, right) => right.target_count - left.target_count)[0]
    const maxSupportedPeople = maxGroupConfig ? maxGroupConfig.target_count : Math.max(...(item.supported_people || [0]))
    const minMemberAmountFen = maxGroupConfig
      ? Number(maxGroupConfig.price_fen) || 0
      : calculatePackageMemberAmountFen({
          totalPrice: item.total_price,
          targetCount: maxSupportedPeople,
          groupPriceConfig: item.group_price_config
        })

    return {
      id: item.id,
      name: item.name,
      cover: item.cover,
      package_category: item.package_category || '体适能',
      class_count: Number(item.class_count) || 0,
      class_duration_minutes: Number(item.class_duration_minutes) || 0,
      group_price_config: item.group_price_config || [],
      max_supported_people: maxSupportedPeople,
      min_member_amount_fen: minMemberAmountFen,
      min_member_amount_text: formatFenText(minMemberAmountFen),
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
    cover: pkg.cover,
    images: (pkg.images && pkg.images.length ? pkg.images : pkg.cover ? [pkg.cover] : []) || [],
    total_price_fen: Number(pkg.total_price) || 0,
    total_price_text: formatFenText(pkg.total_price),
    package_category: pkg.package_category || '体适能',
    class_count: Number(pkg.class_count) || 0,
    class_duration_minutes: Number(pkg.class_duration_minutes) || 0,
    group_price_config: pkg.group_price_config || [],
    supported_people: pkg.supported_people || [],
    location_district: pkg.location_district,
    location_community: pkg.location_community,
    location_detail: pkg.location_detail,
    coach_name: pkg.coach_name,
    coach_intro: pkg.coach_intro,
    coach_certificates: pkg.coach_certificates || [],
    description: pkg.description || '',
    insurance_desc: '课程期间统一赠送基础运动意外险，具体保障范围以投保说明为准。',
    active_groups: (activeGroups || [])
      .sort((left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime())
      .map(group => {
        const memberAmountFen = calculatePackageMemberAmountFen({
          totalPrice: pkg.total_price,
          targetCount: group.target_count,
          groupPriceConfig: pkg.group_price_config
        })

        return {
          id: group.id,
          target_count: Number(group.target_count) || 0,
          current_count: Number(group.current_count) || 0,
          status: group.status,
          remaining_seconds: Math.max(0, Math.floor((new Date(group.deadline).getTime() - now.getTime()) / 1000)),
          member_amount_fen: memberAmountFen,
          member_amount_text: formatFenText(memberAmountFen),
          schedule_text: formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour
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
  const scheduleList = latestGroup.first_class_time
    ? buildPackageLessonSchedule({
        firstClassTime: latestGroup.first_class_time,
        weeks: 5
      })
    : []
  const scheduleMode = scheduleList.length ? 'locked' : 'pending'
  const userJoined = !!(userId && successOrders.some(item => item.user_id === userId))

  return {
    id: latestGroup.id,
    status: latestGroup.status,
    package: {
      id: pkg.id,
      name: pkg.name,
      location_text: buildLocationText(pkg),
      coach_name: pkg.coach_name
    },
    target_count: Number(latestGroup.target_count) || 0,
    current_count: Number(latestGroup.current_count) || 0,
    remaining_seconds:
      latestGroup.status === 'active'
        ? Math.max(0, Math.floor((new Date(latestGroup.deadline).getTime() - now.getTime()) / 1000))
        : 0,
    member_amount_fen: memberAmountFen,
    member_amount_text: formatFenText(memberAmountFen),
    schedule_mode: scheduleMode,
    schedule_text:
      scheduleMode === 'locked'
        ? `首课时间 ${formatPackageDateTime(latestGroup.first_class_time)}，共5次`
        : formatScheduleTextWithLockNote({
            weekday: latestGroup.weekday,
            hour: latestGroup.hour
          }),
    first_class_time: latestGroup.first_class_time ? formatPackageDateTime(latestGroup.first_class_time) : null,
    schedule_list: scheduleList,
    members: successOrders.map(order => ({
      user_id: order.user_id,
      nickname: (usersById[order.user_id] && usersById[order.user_id].nickname) || '微信用户',
      avatar_url: (usersById[order.user_id] && usersById[order.user_id].avatar_url) || ''
    })),
    user_joined: userJoined
  }
}

const fetchMiniProgramUserPackageGroupList = async ({ userId, status = 'all', page = 1, pageSize = 10, now = new Date() }) => {
  ensureMySqlMode()

  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 10)
  const orders = await ordersRepository.listOrders({
    userId,
    orderType: 2,
    statuses: ['success', 'refunded']
  })
  const packageGroupIds = [...new Set((orders || []).map(item => item.package_group_id).filter(Boolean))]
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

  const normalizedStatus = ['active', 'success', 'failed'].includes(status) ? status : 'all'
  const listSource = (orders || [])
    .filter(order => refreshedGroupById[order.package_group_id])
    .filter(order => normalizedStatus === 'all' || refreshedGroupById[order.package_group_id].status === normalizedStatus)
    .sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())

  const from = (safePage - 1) * safePageSize
  const list = listSource.slice(from, from + safePageSize).map(order => {
    const group = refreshedGroupById[order.package_group_id]
    const pkg = packageById[group.package_id]
    const memberAmountFen = calculatePackageMemberAmountFen({
      totalPrice: pkg ? pkg.total_price : 0,
      targetCount: group.target_count,
      groupPriceConfig: pkg ? pkg.group_price_config : []
    })

    return {
      package_group_id: group.id,
      package_id: group.package_id,
      package_name: pkg ? pkg.name : '',
      status: group.status,
      location_text: pkg ? buildLocationText(pkg) : '',
      first_class_time: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
      display_time_text: group.first_class_time
        ? formatPackageDateTime(group.first_class_time)
        : formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour
          }),
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
  fetchMiniProgramPackageDetail,
  fetchMiniProgramPackageGroupDetail,
  fetchMiniProgramPackageList,
  fetchMiniProgramUserPackageGroupList,
  formatFenText
}
