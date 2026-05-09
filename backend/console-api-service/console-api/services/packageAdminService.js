const { env } = require('../../config/env')
const {
  coursePackagesRepository,
  ordersRepository,
  packageGroupsRepository,
  paymentRecordsRepository,
  usersRepository
} = require('../../repositories')
const {
  calculatePackageMemberAmountFen,
  findGroupPriceFen
} = require('../../shared/domain/packageGroupRules')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')
const { cleanupExpiredPackageGroups, closePendingPackageOrdersByIds } = require('../../shared/services/packageGroupStore')
const {
  buildPackageLessonSchedule,
  formatPackageDateTime,
  formatPendingPackageScheduleText
} = require('../../shared/services/packageSchedule')
const { buildAdminLocationText, formatFenText } = require('../../shared/services/packageReaders')
const { parseShanghaiDate } = require('../../shared/utils/dateTime')
const { markPaymentRecordRefunded } = require('../../shared/services/paymentShell')
const { writeAdminLog } = require('../../utils/adminStore')
const { formatDateTime, getPagination, parseShanghaiDateTimeInput } = require('../routes/_helpers')
const { geocodeAddressWithTencentMap, searchPlacesWithTencentMap } = require('./tencentMapService')
const { ensureCondition, ensureFound } = require('./_guards')
const { invokeCloudPayRefund, queryAndSyncCloudPayRefund } = require('./cloudPayRefundGateway')

const PACKAGE_STATUS = {
  INACTIVE: 0,
  ACTIVE: 1,
  PENDING: 2
}
const FIXED_PACKAGE_DEADLINE_HOURS = 48

const ensureMySqlMode = () => {
  ensureCondition(env.useMySqlRepositories, {
    responseCode: 5000,
    statusCode: 501,
    message: '课包拼团后台接口仅支持 MySQL 模式'
  })
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[admin/package] write admin log failed', error)
  }
}

const failActivePackageGroups = async ({ packageId, now = new Date() }) => {
  const activeGroups = await packageGroupsRepository.listPackageGroups({
    packageId,
    statuses: ['active']
  })
  const groupIds = activeGroups.map(item => item.id).filter(Boolean)

  if (!groupIds.length) {
    return {
      groupIds: [],
      refundedOrderIds: [],
      closedOrderIds: []
    }
  }

  await packageGroupsRepository.bulkUpdatePackageGroupStatus({
    packageGroupIds: groupIds,
    status: 'failed'
  })

  const pendingOrders = (
    await Promise.all(
      groupIds.map(groupId =>
        ordersRepository.listOrdersByPackageGroupId({
          packageGroupId: groupId,
          status: 'pending'
        })
      )
    )
  ).flat()

  const successOrders = (
    await Promise.all(
      groupIds.map(groupId =>
        ordersRepository.listOrdersByPackageGroupId({
          packageGroupId: groupId,
          status: 'success'
        })
      )
    )
  ).flat()

  const closedOrders = await closePendingPackageOrdersByIds({
    orderIds: pendingOrders.map(item => item.id).filter(Boolean),
    now
  })

  await Promise.all(
    successOrders.map(async order => {
      await ordersRepository.updateOrder(order.id, {
        status: 'refunded',
        refund_time: now,
        refund_reason: AUTO_REFUND_REASON,
        updated_at: now
      })
      await markPaymentRecordRefunded({
        supabase: null,
        orderId: order.id,
        reason: AUTO_REFUND_REASON,
        now
      })
    })
  )

  return {
    groupIds,
    refundedOrderIds: successOrders.map(item => item.id).filter(Boolean),
    closedOrderIds: (closedOrders || []).map(item => item.id).filter(Boolean)
  }
}

const toMap = (list = [], key = 'id') =>
  list.reduce((result, item) => {
    result[item[key]] = item
    return result
  }, {})

const normalizeText = value => `${value || ''}`.trim()

const buildPackageRefundOutRefundNo = order => {
  const base = (order && (order.order_no || order.id) ? `${order.order_no || order.id}` : '').replace(/[^a-zA-Z0-9_-]/g, '')
  const outTradeNo = base || `order_${Date.now()}`
  return `RF-${outTradeNo}`.slice(0, 64)
}

const normalizeCoachAssignment = value => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const lessons = Array.isArray(value.lessons)
    ? value.lessons
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null
          }

          const index = Number(item.index)
          const classTime = normalizeText(item.class_time)
          const coachName = normalizeText(item.coach_name)
          if (!Number.isInteger(index) || index <= 0 || !classTime) {
            return null
          }

          return {
            index,
            class_time: classTime,
            coach_name: coachName
          }
        })
        .filter(Boolean)
        .sort((left, right) => left.index - right.index)
    : []

  return {
    default_coach_name: normalizeText(value.default_coach_name),
    lessons
  }
}

const buildLessonCoachSchedule = ({ scheduleList = [], coachAssignment = null }) => {
  const normalizedAssignment = normalizeCoachAssignment(coachAssignment)
  const lessonCoachMap = (normalizedAssignment && normalizedAssignment.lessons) || []
  const coachByKey = lessonCoachMap.reduce((result, item) => {
    result[`${item.index}::${item.class_time}`] = item.coach_name
    return result
  }, {})

  return (scheduleList || []).map((item, index) => {
    const classTime = normalizeText(item && (item.class_time || item.display_text))
    const lessonIndex = Number(item && item.index) || index + 1
    const coachName = coachByKey[`${lessonIndex}::${classTime}`] || normalizedAssignment?.default_coach_name || ''

    return {
      index: lessonIndex,
      class_time: classTime,
      display_text: normalizeText(item && item.display_text) || classTime,
      coach_name: coachName
    }
  })
}

const formatCoachLabel = coachName => normalizeText(coachName) || '教练待定'

const formatLessonCoachText = lesson => `${lesson.display_text || lesson.class_time || '-'} ${formatCoachLabel(lesson.coach_name)}`

const normalizePackageContext = value => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value
}

const pickParentMobile = context => normalizeText(context.parent_mobile || context.parent_phone || context.phone)

const pickChildNickname = context => normalizeText(context.child_nickname)

const pickChildAge = context => {
  const number = Number(context.child_age)
  return Number.isFinite(number) && number > 0 ? number : null
}

const normalizeOptionalNumber = value => {
  if (value === undefined) {
    return undefined
  }

  if (value === null || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

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

const normalizePackageStatus = (value, fallback = PACKAGE_STATUS.PENDING) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'number') {
    if (value === PACKAGE_STATUS.INACTIVE || value === PACKAGE_STATUS.ACTIVE || value === PACKAGE_STATUS.PENDING) {
      return value
    }
    return fallback
  }

  const normalized = `${value}`.trim().toLowerCase()
  if (['0', 'inactive', 'offline', 'disabled', '下架'].includes(normalized)) {
    return PACKAGE_STATUS.INACTIVE
  }
  if (['1', 'active', 'online', 'enabled', '上架'].includes(normalized)) {
    return PACKAGE_STATUS.ACTIVE
  }
  if (['2', 'pending', '待上架'].includes(normalized)) {
    return PACKAGE_STATUS.PENDING
  }

  return fallback
}

const normalizePackageStatusFilter = value => {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  return normalizePackageStatus(value)
}

const resolvePackageStatus = ({ status, publishTime, unpublishTime, now = new Date() }) => {
  const normalizedStatus = normalizePackageStatus(status)
  if (normalizedStatus === PACKAGE_STATUS.INACTIVE) {
    return PACKAGE_STATUS.INACTIVE
  }

  if (unpublishTime) {
    const unpublishDate = parseShanghaiDate(unpublishTime)
    if (unpublishDate && unpublishDate.getTime() <= now.getTime()) {
      return PACKAGE_STATUS.INACTIVE
    }
  }

  const publishDate = parseShanghaiDate(publishTime)
  if (!publishDate) {
    return PACKAGE_STATUS.PENDING
  }

  return publishDate.getTime() > now.getTime() ? PACKAGE_STATUS.PENDING : PACKAGE_STATUS.ACTIVE
}

const canOfflinePackage = status => {
  const resolvedStatus = normalizePackageStatus(status)
  return resolvedStatus === PACKAGE_STATUS.ACTIVE
}

const mapPackageStatus = value => {
  const normalized = normalizePackageStatus(value)
  if (normalized === PACKAGE_STATUS.ACTIVE) return 'active'
  if (normalized === PACKAGE_STATUS.PENDING) return 'pending'
  return 'inactive'
}

const mapPackageStatusText = value => {
  const status = mapPackageStatus(value)
  if (status === 'active') return '已上架'
  if (status === 'pending') return '待上架'
  return '已下架'
}

const canEditPackage = status => {
  const resolvedStatus = normalizePackageStatus(status)
  return resolvedStatus === PACKAGE_STATUS.PENDING || resolvedStatus === PACKAGE_STATUS.INACTIVE
}

const normalizeSupportedPeople = value => coursePackagesRepository.normalizeSupportedPeople(value)
const normalizeGroupPriceConfig = value => coursePackagesRepository.normalizeGroupPriceConfig(value)
const deriveSupportedPeopleFromGroupPriceConfig = config =>
  normalizeSupportedPeople(normalizeGroupPriceConfig(config).map(item => item.target_count))
const deriveTotalPriceFromGroupPriceConfig = config =>
  normalizeGroupPriceConfig(config).reduce(
    (maxAmount, item) => Math.max(maxAmount, (Number(item.target_count) || 0) * (Number(item.price_fen) || 0)),
    0
  )
const PACKAGE_CATEGORIES = (coursePackagesRepository && coursePackagesRepository.PACKAGE_CATEGORIES) || ['体适能', '跳绳']
const normalizePackageCategory = value =>
  coursePackagesRepository && typeof coursePackagesRepository.normalizePackageCategory === 'function'
    ? coursePackagesRepository.normalizePackageCategory(value)
    : PACKAGE_CATEGORIES.includes(normalizeText(value))
      ? normalizeText(value)
      : '体适能'

const validatePackagePayload = (payload = {}, { partial = false } = {}) => {
  const requiredFields = [
    ['name', '课包名称不能为空'],
    ['package_category', '课包类型不能为空'],
    ['age_range', '适用年龄不能为空'],
    ['cover', '封面图不能为空'],
    ['location_district', '所在区域不能为空'],
    ['location_community', '小区名称不能为空'],
    ['location_detail', '详细地点不能为空'],
    ['coach_intro', '教练简介不能为空'],
    ['description', '课程介绍不能为空'],
    ['publish_time', '上架时间不能为空']
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

  if (!partial || payload.package_category !== undefined) {
    ensureCondition(PACKAGE_CATEGORIES.includes(normalizeText(payload.package_category)), {
      responseCode: 1001,
      statusCode: 400,
      message: '课包类型仅支持体适能或跳绳'
    })
  }

  if (!partial || payload.class_count !== undefined) {
    const classCount = Number(payload.class_count)
    ensureCondition(Number.isInteger(classCount) && classCount > 0, {
      responseCode: 1001,
      statusCode: 400,
      message: '课程节数必须大于 0'
    })
  }

  if (!partial || payload.class_duration_minutes !== undefined) {
    const duration = Number(payload.class_duration_minutes)
    ensureCondition(Number.isInteger(duration) && duration > 0, {
      responseCode: 1001,
      statusCode: 400,
      message: '单节课时长必须大于 0'
    })
  }

  if (!partial || payload.group_price_config !== undefined) {
    const config = normalizeGroupPriceConfig(payload.group_price_config)
    ensureCondition(config.length > 0, {
      responseCode: 1001,
      statusCode: 400,
      message: '团型售价配置不能为空'
    })

    ensureCondition(new Set(config.map(item => item.target_count)).size === config.length, {
      responseCode: 1001,
      statusCode: 400,
      message: '团型人数不能重复'
    })
  }
}

const mapPackagePayloadToDb = ({ payload = {}, admin = {}, create = false, existing = null, now = new Date() }) => {
  const dbPayload = {}
  const assign = (target, source = target, transform = current => current) => {
    if (payload[source] === undefined) {
      return
    }

    dbPayload[target] = transform(payload[source])
  }

  assign('name', 'name', normalizeText)
  assign('package_category', 'package_category', normalizePackageCategory)
  assign('age_range', 'age_range', normalizeText)
  assign('cover', 'cover', normalizeText)
  assign('images', 'images', value => {
    const items = Array.isArray(value) ? value.filter(Boolean) : []
    return items.length ? items : payload.cover ? [normalizeText(payload.cover)] : existing && existing.cover ? [existing.cover] : []
  })
  assign('total_price', 'total_price_fen', value => Number(value) || 0)
  assign('total_price', 'total_price', value => Number(value) || 0)
  assign('class_count', 'class_count', value => Number(value) || 0)
  assign('class_duration_minutes', 'class_duration_minutes', value => Number(value) || 0)
  assign('group_price_config', 'group_price_config', normalizeGroupPriceConfig)
  assign('location_district', 'location_district', normalizeText)
  assign('location_community', 'location_community', normalizeText)
  assign('location_detail', 'location_detail', normalizeText)
  assign('longitude', 'longitude', normalizeOptionalNumber)
  assign('latitude', 'latitude', normalizeOptionalNumber)
  assign('coach_name', 'coach_name', normalizeText)
  assign('coach_intro', 'coach_intro', normalizeText)
  assign('coach_certificates', 'coach_certificates', value => (Array.isArray(value) ? value.filter(Boolean) : []))
  assign('description', 'description', normalizeText)
  dbPayload.deadline_hours = FIXED_PACKAGE_DEADLINE_HOURS
  assign('publish_time', 'publish_time', normalizeDateTimeValue)
  assign('unpublish_time', 'unpublish_time', normalizeDateTimeValue)

  const nextGroupPriceConfig =
    dbPayload.group_price_config !== undefined
      ? dbPayload.group_price_config
      : existing && existing.group_price_config
        ? normalizeGroupPriceConfig(existing.group_price_config)
        : []

  if (dbPayload.group_price_config !== undefined || payload.supported_people !== undefined || create) {
    dbPayload.supported_people = deriveSupportedPeopleFromGroupPriceConfig(nextGroupPriceConfig)
  }

  if (dbPayload.group_price_config !== undefined || create) {
    dbPayload.total_price = deriveTotalPriceFromGroupPriceConfig(nextGroupPriceConfig)
  } else if (payload.total_price_fen !== undefined || payload.total_price !== undefined) {
    dbPayload.total_price = Number(payload.total_price_fen ?? payload.total_price) || 0
  }

  if (create) {
    const publishTime = dbPayload.publish_time !== undefined ? dbPayload.publish_time : payload.publish_time
    const unpublishTime = dbPayload.unpublish_time !== undefined ? dbPayload.unpublish_time : payload.unpublish_time
    dbPayload.status = resolvePackageStatus({
      status: PACKAGE_STATUS.PENDING,
      publishTime,
      unpublishTime,
      now
    })
    dbPayload.created_by = admin.id || null
  } else {
    const currentStatus = existing ? existing.status : PACKAGE_STATUS.PENDING
    const publishTime =
      dbPayload.publish_time !== undefined
        ? dbPayload.publish_time
        : existing
          ? existing.publish_time
          : payload.publish_time
    const unpublishTime =
      dbPayload.unpublish_time !== undefined
        ? dbPayload.unpublish_time
        : existing
          ? existing.unpublish_time
          : payload.unpublish_time

    if (normalizePackageStatus(currentStatus) !== PACKAGE_STATUS.INACTIVE) {
      dbPayload.status = resolvePackageStatus({
        status: currentStatus,
        publishTime,
        unpublishTime,
        now
      })
    }
  }

  dbPayload.updated_by = admin.id || null
  return dbPayload
}

const mapPackageListItem = (item, { now = new Date() } = {}) => {
  const resolvedStatus = resolvePackageStatus({
    status: item.status,
    publishTime: item.publish_time,
    unpublishTime: item.unpublish_time,
    now
  })

  return {
    id: item.id,
    name: item.name,
    cover: item.cover || '',
    total_price_fen: Number(item.total_price) || 0,
    total_price_text: formatFenText(item.total_price),
    package_category: item.package_category || '体适能',
    age_range: item.age_range || item.age_limit || '',
    class_count: Number(item.class_count) || 0,
    class_duration_minutes: Number(item.class_duration_minutes) || 0,
    group_price_config: item.group_price_config || [],
    supported_people: item.supported_people || [],
    location_text: buildAdminLocationText(item),
    location_district: item.location_district || '',
    location_community: item.location_community || '',
    location_detail: item.location_detail || '',
    coach_name: item.coach_name || '',
    publish_time: formatDateTime(item.publish_time),
    unpublish_time: formatDateTime(item.unpublish_time),
    status: mapPackageStatus(resolvedStatus),
    status_text: mapPackageStatusText(resolvedStatus),
    deadline_hours: Number(item.deadline_hours) || 48,
    create_time: formatDateTime(item.created_at),
    update_time: formatDateTime(item.updated_at)
  }
}

const mapPackageDetail = (item, { now = new Date() } = {}) => ({
  ...mapPackageListItem(item, { now }),
  images: item.images || [],
  longitude: item.longitude,
  latitude: item.latitude,
  coach_intro: item.coach_intro || '',
  coach_certificates: item.coach_certificates || [],
  description: item.description || '',
  created_by: item.created_by || '',
  updated_by: item.updated_by || ''
})

const listAdminPackages = async ({ query = {}, now = new Date() }) => {
  ensureMySqlMode()

  const { page, size, from, to } = getPagination(query)
  const status = normalizePackageStatusFilter(query.status)
  const packages = await coursePackagesRepository.listPackages({
    keyword: normalizeText(query.keyword),
    category: normalizeText(query.package_category)
  })

  const filteredPackages = packages.filter(item => {
    if (status === '') {
      return true
    }

    return resolvePackageStatus({
      status: item.status,
      publishTime: item.publish_time,
      unpublishTime: item.unpublish_time,
      now
    }) === status
  })

  return {
    total: filteredPackages.length,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(filteredPackages.length / size)),
    list: filteredPackages.slice(from, to + 1).map(item => mapPackageListItem(item, { now }))
  }
}

const getAdminPackageDetail = async ({ packageId, now = new Date() }) => {
  ensureMySqlMode()

  const pkg = await coursePackagesRepository.findPackageById(packageId)
  ensureFound(pkg, {
    responseCode: 2001,
    message: '课包不存在'
  })

  return mapPackageDetail(pkg, { now })
}

const createAdminPackage = async ({ payload = {}, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()
  validatePackagePayload(payload)

  const created = await coursePackagesRepository.createPackage(
    mapPackagePayloadToDb({
      payload,
      admin,
      create: true,
      now
    })
  )

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_create',
    targetType: 'course_package',
    targetId: created.id,
    detail: {
      name: created.name,
      package_category: created.package_category || '体适能',
      age_range: created.age_range || '',
      status: mapPackageStatus(
        resolvePackageStatus({
          status: created.status,
          publishTime: created.publish_time,
          unpublishTime: created.unpublish_time,
          now
        })
      ),
      total_price_fen: Number(created.total_price) || 0,
      class_count: Number(created.class_count) || 0,
      class_duration_minutes: Number(created.class_duration_minutes) || 0,
      group_price_config: created.group_price_config || [],
      supported_people: created.supported_people || [],
      publish_time: formatDateTime(created.publish_time)
    },
    ip
  })

  return mapPackageDetail(created, { now })
}

const updateAdminPackage = async ({ packageId, payload = {}, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const existing = await coursePackagesRepository.findPackageById(packageId)
  ensureFound(existing, {
    responseCode: 2001,
    message: '课包不存在'
  })
  const currentStatus = resolvePackageStatus({
    status: existing.status,
    publishTime: existing.publish_time,
    unpublishTime: existing.unpublish_time,
    now
  })
  ensureCondition(canEditPackage(existing.status), {
    responseCode: 1001,
    statusCode: 400,
    message: '已上架课包不可编辑'
  })
  validatePackagePayload(payload, { partial: true })

  const updated = await coursePackagesRepository.updatePackage(
    packageId,
    mapPackagePayloadToDb({
      payload,
      admin,
      existing,
      now
    })
  )

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_update',
    targetType: 'course_package',
    targetId: updated.id,
    detail: {
      name: updated.name,
      package_category: updated.package_category || '体适能',
      age_range: updated.age_range || '',
      previous_status: mapPackageStatus(currentStatus),
      next_status: mapPackageStatus(
        resolvePackageStatus({
          status: updated.status,
          publishTime: updated.publish_time,
          unpublishTime: updated.unpublish_time,
          now
        })
      ),
      total_price_fen: Number(updated.total_price) || 0,
      class_count: Number(updated.class_count) || 0,
      class_duration_minutes: Number(updated.class_duration_minutes) || 0,
      group_price_config: updated.group_price_config || [],
      supported_people: updated.supported_people || [],
      publish_time: formatDateTime(updated.publish_time)
    },
    ip
  })

  return mapPackageDetail(updated, { now })
}

const offlineAdminPackage = async ({ packageId, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const existing = await coursePackagesRepository.findPackageById(packageId)
  ensureFound(existing, {
    responseCode: 2001,
    message: '课包不存在'
  })

  const currentStatus = resolvePackageStatus({
    status: existing.status,
    publishTime: existing.publish_time,
    unpublishTime: existing.unpublish_time,
    now
  })

  ensureCondition(canOfflinePackage(currentStatus), {
    responseCode: 1001,
    statusCode: 400,
    message: '当前课包状态不支持下架'
  })

  const expiredCleanupResult = await cleanupExpiredPackageGroups({ packageId, now })
  const activeGroupCleanupResult = await failActivePackageGroups({ packageId, now })

  const offlinedAt = now.toISOString()
  const updated = await coursePackagesRepository.updatePackage(packageId, {
    status: PACKAGE_STATUS.INACTIVE,
    unpublish_time: offlinedAt,
    updated_by: admin.id || null,
    updated_at: offlinedAt
  })

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_offline',
    targetType: 'course_package',
    targetId: updated.id,
    detail: {
      name: updated.name,
      previous_status: mapPackageStatus(currentStatus),
      next_status: mapPackageStatus(PACKAGE_STATUS.INACTIVE),
      offline_at: formatDateTime(offlinedAt),
      unpublish_time: formatDateTime(updated.unpublish_time),
      auto_failed_group_ids: [...new Set([...(expiredCleanupResult.groupIds || []), ...(activeGroupCleanupResult.groupIds || [])])],
      auto_refunded_order_ids: [...new Set([...(expiredCleanupResult.refundedOrderIds || []), ...(activeGroupCleanupResult.refundedOrderIds || [])])],
      auto_closed_order_ids: [...new Set([...(expiredCleanupResult.closedOrderIds || []), ...(activeGroupCleanupResult.closedOrderIds || [])])]
    },
    ip
  })

  return mapPackageDetail(updated, { now })
}

const searchPackageLocations = async ({ query = {} }) => {
  ensureMySqlMode()

  const keyword = normalizeText(query.keyword)
  const district = normalizeText(query.district)
  const limit = Number(query.limit) || 8
  const list = await searchPlacesWithTencentMap({
    keyword,
    district,
    limit
  })

  return { list }
}

const geocodePackageAddress = async ({ district, detail }) => {
  ensureMySqlMode()

  return geocodeAddressWithTencentMap({
    district: normalizeText(district),
    detail: normalizeText(detail)
  })
}

const listAdminPackageGroups = async ({ query = {}, now = new Date() }) => {
  ensureMySqlMode()

  await cleanupExpiredPackageGroups({
    packageId: normalizeText(query.package_id),
    now
  })

  const { page, size, from, to } = getPagination(query)
  const groups = await packageGroupsRepository.listPackageGroups({
    packageId: normalizeText(query.package_id),
    status: normalizeText(query.status)
  })
  const packageIds = [...new Set(groups.map(item => item.package_id).filter(Boolean))]
  const packages = await coursePackagesRepository.findPackagesByIds(packageIds)
  const packagesById = toMap(packages)

  const list = groups.map(group => {
    const pkg = packagesById[group.package_id] || {}
    const deadline = parseShanghaiDate(group.deadline)
    const memberAmountFen = calculatePackageMemberAmountFen({
      totalPrice: pkg.total_price,
      targetCount: group.target_count,
      groupPriceConfig: pkg.group_price_config
    })
    const baseScheduleList = group.first_class_time
      ? buildPackageLessonSchedule({
          firstClassTime: group.first_class_time,
          weeks: 5
        })
      : []
    const lessonSchedule = buildLessonCoachSchedule({
      scheduleList: baseScheduleList,
      coachAssignment: group.coach_assignment
    })

    return {
      id: group.id,
      package_id: group.package_id || '',
      package_name: pkg.name || '',
      creator_id: group.creator_id || '',
      status: group.status || 'active',
      target_count: Number(group.target_count) || 0,
      current_count: Number(group.current_count) || 0,
      member_amount_fen: memberAmountFen,
      member_amount_text: formatFenText(memberAmountFen),
      deadline: formatDateTime(group.deadline),
      remaining_seconds: group.status === 'active' && deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000)) : 0,
      weekday: Number(group.weekday) || 0,
      hour: Number(group.hour) || 0,
      schedule_text: group.first_class_time
        ? `首课时间 ${formatPackageDateTime(group.first_class_time)}，共5次`
        : formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour
          }),
      first_class_time: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
      schedule_list: lessonSchedule,
      coach_assignment: normalizeCoachAssignment(group.coach_assignment),
      create_time: formatDateTime(group.created_at),
      success_time: formatDateTime(group.success_time)
    }
  })

  return {
    total: list.length,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(list.length / size)),
    list: list.slice(from, to + 1)
  }
}

const getAdminPackageGroupDetail = async ({ packageGroupId, now = new Date() }) => {
  ensureMySqlMode()

  let group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  ensureFound(group, {
    responseCode: 2004,
    message: '课包拼团不存在'
  })

  await cleanupExpiredPackageGroups({
    packageId: group.package_id,
    now
  })

  group = await packageGroupsRepository.findPackageGroupById(packageGroupId)

  const orders = await ordersRepository.listOrdersByPackageGroupId({ packageGroupId })
  const userIds = [...new Set(orders.map(item => item.user_id).filter(Boolean))]
  const [pkg, users] = await Promise.all([
    coursePackagesRepository.findPackageById(group.package_id),
    userIds.length ? usersRepository.listUsersByIds(userIds) : Promise.resolve([])
  ])

  ensureFound(pkg, {
    responseCode: 2001,
    message: '课包不存在'
  })

  const usersById = toMap(users)
  const memberAmountFen = calculatePackageMemberAmountFen({
    totalPrice: pkg.total_price,
    targetCount: group.target_count,
    groupPriceConfig: pkg.group_price_config
  })
  const baseScheduleList = group.first_class_time
    ? buildPackageLessonSchedule({
        firstClassTime: group.first_class_time,
        weeks: 5
      })
    : []
  const lessonSchedule = buildLessonCoachSchedule({
    scheduleList: baseScheduleList,
    coachAssignment: group.coach_assignment
  })

  const sortedOrders = [...orders].sort(
    (left, right) =>
      (parseShanghaiDate(left.created_at || 0)?.getTime() || 0) - (parseShanghaiDate(right.created_at || 0)?.getTime() || 0)
  )
  const leaderOrder = sortedOrders.find(item => item.package_action === 'start') || sortedOrders[0] || null
  const paidOrders = sortedOrders.filter(item => item.status === 'success')
  const refundedOrders = sortedOrders.filter(item => item.status === 'refunded')
  const pendingOrders = sortedOrders.filter(item => item.status === 'pending')

  const members = sortedOrders.map(order => {
    const context = normalizePackageContext(order.package_context)
    const user = usersById[order.user_id] || {}

    return {
      order_id: order.id,
      order_no: order.order_no || order.id,
      user_id: order.user_id || '',
      user_nickname: user.nickname || '',
      role: order.package_action === 'start' ? 'leader' : 'member',
      action: order.package_action || '',
      child_nickname: pickChildNickname(context),
      child_age: pickChildAge(context),
      parent_mobile: pickParentMobile(context),
      joined_at: formatDateTime(order.pay_time || order.created_at),
      order_status: mapOrderStatus(order.status)
    }
  })

  const anomalies = []
  if (group.status === 'failed' && paidOrders.length > 0) {
    anomalies.push('已失败拼团仍存在未退款成功订单')
  }
  const deadline = parseShanghaiDate(group.deadline)
  if (group.status === 'active' && deadline && deadline.getTime() <= now.getTime()) {
    anomalies.push('进行中拼团已超过截止时间')
  }
  if ((Number(group.current_count) || 0) !== paidOrders.length) {
    anomalies.push('当前人数与已支付有效订单数不一致')
  }
  if (group.status === 'success' && !group.first_class_time) {
    anomalies.push('已成团但缺失首课时间')
  }
  if (
    paidOrders.some(order => {
      const context = normalizePackageContext(order.package_context)
      return !pickChildNickname(context) || !pickChildAge(context) || !pickParentMobile(context)
    })
  ) {
    anomalies.push('成员报名信息存在缺失')
  }

  return {
    id: group.id,
    package_id: group.package_id || '',
    package_name: pkg.name || '',
    package_status: mapPackageStatus(
      resolvePackageStatus({
        status: pkg.status,
        publishTime: pkg.publish_time,
        unpublishTime: pkg.unpublish_time,
        now
      })
    ),
    package_status_text: mapPackageStatusText(
      resolvePackageStatus({
        status: pkg.status,
        publishTime: pkg.publish_time,
        unpublishTime: pkg.unpublish_time,
        now
      })
    ),
    status: group.status || 'active',
    creator_id: group.creator_id || '',
    target_count: Number(group.target_count) || 0,
    current_count: Number(group.current_count) || 0,
    member_amount_fen: memberAmountFen,
    member_amount_text: formatFenText(memberAmountFen),
    weekday: Number(group.weekday) || 0,
    hour: Number(group.hour) || 0,
    schedule_text: group.first_class_time
      ? `首课时间 ${formatPackageDateTime(group.first_class_time)}，共5次`
      : formatPendingPackageScheduleText({
          weekday: group.weekday,
          hour: group.hour
        }),
    first_class_time: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
    schedule_list: lessonSchedule,
    coach_assignment: normalizeCoachAssignment(group.coach_assignment),
    create_time: formatDateTime(group.created_at),
    deadline: formatDateTime(group.deadline),
    success_time: formatDateTime(group.success_time),
    leader: leaderOrder
      ? {
          order_id: leaderOrder.id,
          order_no: leaderOrder.order_no || leaderOrder.id,
          action: leaderOrder.package_action || 'start',
          child_nickname: pickChildNickname(normalizePackageContext(leaderOrder.package_context)),
          child_age: pickChildAge(normalizePackageContext(leaderOrder.package_context)),
          parent_mobile: pickParentMobile(normalizePackageContext(leaderOrder.package_context)),
          joined_at: formatDateTime(leaderOrder.pay_time || leaderOrder.created_at)
        }
      : null,
    summary: {
      paid_order_count: paidOrders.length,
      refunded_order_count: refundedOrders.length,
      pending_order_count: pendingOrders.length
    },
    anomalies,
    members,
    orders: sortedOrders.map(order => {
      const context = normalizePackageContext(order.package_context)
      const user = usersById[order.user_id] || {}

      return {
        id: order.id,
        order_no: order.order_no || order.id,
        user_id: order.user_id || '',
        nickname: user.nickname || '',
        child_nickname: pickChildNickname(context),
        child_age: pickChildAge(context),
        phone: pickParentMobile(context),
        amount_fen: Number(order.amount) || 0,
        amount_text: formatFenText(order.amount),
        status: mapOrderStatus(order.status),
        action: order.package_action || '',
        refund_reason: order.refund_reason || '',
        refund_type: order.refund_reason === AUTO_REFUND_REASON ? 'system' : order.refund_reason ? 'manual' : '',
        create_time: formatDateTime(order.created_at),
        pay_time: formatDateTime(order.pay_time),
        refund_time: formatDateTime(order.refund_time)
      }
    })
  }
}

const updateAdminPackageGroupCoachAssignment = async ({ packageGroupId, payload = {}, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  ensureFound(group, {
    responseCode: 2004,
    message: '课包拼团不存在'
  })

  ensureCondition(group.status === 'success', {
    responseCode: 1001,
    statusCode: 400,
    message: '仅已成团拼团支持安排教练'
  })

  ensureCondition(!!group.first_class_time, {
    responseCode: 1001,
    statusCode: 400,
    message: '当前拼团尚未生成排课信息，暂不能安排教练'
  })

  const baseScheduleList = buildPackageLessonSchedule({
    firstClassTime: group.first_class_time,
    weeks: 5
  })

  const defaultCoachName = normalizeText(payload.default_coach_name)
  const inputLessons = Array.isArray(payload.lessons) ? payload.lessons : []
  const providedLessonMap = inputLessons.reduce((result, item) => {
    if (!item || typeof item !== 'object') {
      return result
    }

    const index = Number(item.index)
    if (!Number.isInteger(index) || index <= 0) {
      return result
    }

    result[index] = normalizeText(item.coach_name)
    return result
  }, {})

  const lessons = baseScheduleList.map((item, index) => ({
    index: Number(item.index) || index + 1,
    class_time: normalizeText(item.display_text || item.class_time),
    coach_name: providedLessonMap[Number(item.index) || index + 1] || defaultCoachName || ''
  }))

  const coachAssignment = {
    default_coach_name: defaultCoachName,
    lessons
  }

  await packageGroupsRepository.updatePackageGroup(packageGroupId, {
    coach_assignment: coachAssignment
  })

  await safeWriteAdminLog({
    adminId: admin.id || '',
    adminUsername: admin.username || '',
    adminRole: admin.role || '',
    action: 'package_group_assign_coach',
    targetType: 'package_group',
    targetId: packageGroupId,
    detail: {
      default_coach_name: defaultCoachName,
      lessons
    },
    ip,
    createdAt: now
  })

  return getAdminPackageGroupDetail({
    packageGroupId,
    now
  })
}

const mapOrderStatus = status => status || 'pending'

const listAdminPackageOrders = async ({ query = {} }) => {
  ensureMySqlMode()

  const { page, size, from, to } = getPagination(query)
  const packageId = normalizeText(query.package_id)
  const packageGroupId = normalizeText(query.package_group_id)
  const status = normalizeText(query.status)
  const keyword = normalizeText(query.keyword)
  const orders = await ordersRepository.listOrders({
    orderType: 2,
    packageId,
    packageGroupId,
    status
  })
  const userIds = [...new Set(orders.map(item => item.user_id).filter(Boolean))]
  const packageIds = [...new Set(orders.map(item => item.package_id).filter(Boolean))]
  const groupIds = [...new Set(orders.map(item => item.package_group_id).filter(Boolean))]
  const [users, packages, groups] = await Promise.all([
    userIds.length ? usersRepository.listUsersByIds(userIds) : Promise.resolve([]),
    packageIds.length ? coursePackagesRepository.findPackagesByIds(packageIds) : Promise.resolve([]),
    groupIds.length ? packageGroupsRepository.findPackageGroupsByIds(groupIds) : Promise.resolve([])
  ])
  const usersById = toMap(users)
  const packagesById = toMap(packages)
  const groupsById = toMap(groups)

  const list = orders
    .map(order => {
      const user = usersById[order.user_id] || {}
      const pkg = packagesById[order.package_id] || {}
      const group = groupsById[order.package_group_id] || {}

      return {
        id: order.id,
        order_no: order.order_no || order.id,
        user_id: order.user_id || '',
        nickname: user.nickname || '',
        child_nickname: pickChildNickname(normalizePackageContext(order.package_context)),
        child_age: pickChildAge(normalizePackageContext(order.package_context)),
        phone: pickParentMobile(normalizePackageContext(order.package_context)),
        avatar_url: user.avatar_url || '',
        package_id: order.package_id || '',
        package_name: pkg.name || '',
        package_group_id: order.package_group_id || '',
        package_group_status: group.status || '',
        amount_fen: Number(order.amount) || 0,
        amount_text: formatFenText(order.amount),
        status: mapOrderStatus(order.status),
        order_type: Number(order.order_type) || 2,
        action: order.package_action || '',
        refund_reason: order.refund_reason || '',
        refund_type: order.refund_reason === AUTO_REFUND_REASON ? 'system' : order.refund_reason ? 'manual' : '',
        create_time: formatDateTime(order.created_at),
        update_time: formatDateTime(order.updated_at),
        pay_time: formatDateTime(order.pay_time),
        refund_time: formatDateTime(order.refund_time)
      }
    })
    .filter(item => {
      if (!keyword) {
        return true
      }

      return (
        item.id.includes(keyword) ||
        item.order_no.includes(keyword) ||
        item.nickname.includes(keyword) ||
        item.child_nickname.includes(keyword) ||
        `${item.child_age || ''}`.includes(keyword) ||
        item.phone.includes(keyword) ||
        item.package_name.includes(keyword) ||
        item.package_group_id.includes(keyword)
      )
    })

  return {
    total: list.length,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(list.length / size)),
    list: list.slice(from, to + 1)
  }
}

const refundAdminPackageOrder = async ({ orderId, reason, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const normalizedReason = normalizeText(reason)
  ensureCondition(!!normalizedReason, {
    responseCode: 1001,
    statusCode: 400,
    message: '退款原因不能为空'
  })

  const order = await ordersRepository.findOrderById(orderId)
  ensureFound(order, {
    responseCode: 2003,
    message: '订单不存在'
  })
  ensureCondition(Number(order.order_type) === 2, {
    responseCode: 2003,
    statusCode: 400,
    message: '订单不是课包拼团订单'
  })
  ensureCondition(order.status === 'success', {
    responseCode: 2006,
    statusCode: 400,
    message: '只有已支付订单才允许退款'
  })

  const group = order.package_group_id
    ? await packageGroupsRepository.findPackageGroupById(order.package_group_id)
    : null

  ensureCondition(!group || group.status !== 'success', {
    responseCode: 2006,
    statusCode: 400,
    message: '已成团拼团不支持个人线上退款'
  })

  let updatedOrder = await ordersRepository.updateOrder(order.id, {
    status: 'refund_pending',
    refund_reason: normalizedReason,
    refund_operator_id: admin.id || null,
    updated_at: now
  })

  try {
    await invokeCloudPayRefund({
      orderId: order.id,
      reason: normalizedReason,
      operatorId: admin.id || ''
    })
  } catch (error) {
    updatedOrder = await ordersRepository.updateOrder(order.id, {
      status: 'refund_failed',
      updated_at: now
    })
    throw error
  }

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_order_refund',
    targetType: 'order',
    targetId: updatedOrder.id,
    detail: {
      order_no: updatedOrder.order_no || updatedOrder.id,
      package_id: updatedOrder.package_id || '',
      package_group_id: updatedOrder.package_group_id || '',
      amount_fen: Number(updatedOrder.amount) || 0,
      previous_status: order.status,
      next_status: updatedOrder.status,
      refund_reason: normalizedReason,
      group_detail: group
        ? {
            id: group.id,
            previous_status: group.status,
            next_status: group.status,
            previous_count: Number(group.current_count) || 0,
            next_count: Number(group.current_count) || 0
          }
        : null
    },
    ip
  })

  return {
    id: updatedOrder.id,
    status: updatedOrder.status,
    refund_time: formatDateTime(updatedOrder.refund_time),
    refund_reason: updatedOrder.refund_reason || '',
    payment_record_status: 'refund_pending',
    group: group
      ? {
          id: group.id,
          previous_status: group.status,
          next_status: group.status,
          previous_count: Number(group.current_count) || 0,
          next_count: Number(group.current_count) || 0
        }
      : null,
    closed_pending_order_ids: []
  }
}

const refundAdminPackageGroup = async ({ packageGroupId, reason, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const normalizedReason = normalizeText(reason)
  ensureCondition(!!normalizedReason, {
    responseCode: 1001,
    statusCode: 400,
    message: '退款原因不能为空'
  })

  const group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  ensureFound(group, {
    responseCode: 2002,
    message: '拼团不存在'
  })
  ensureCondition(group.status === 'success', {
    responseCode: 2006,
    statusCode: 400,
    message: '只有已成团拼团才允许整团退款'
  })

  const successOrders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId,
    status: 'success'
  })
  ensureCondition(successOrders.length > 0, {
    responseCode: 2003,
    statusCode: 400,
    message: '拼团下无可退款订单'
  })

  const orderIds = []
  for (const order of successOrders) {
    await ordersRepository.updateOrder(order.id, {
      status: 'refund_pending',
      refund_reason: normalizedReason,
      refund_operator_id: admin.id || null,
      updated_at: now
    })

    try {
      await invokeCloudPayRefund({
        orderId: order.id,
        reason: normalizedReason,
        operatorId: admin.id || ''
      })
      orderIds.push(order.id)
    } catch (error) {
      await ordersRepository.updateOrder(order.id, {
        status: 'refund_failed',
        updated_at: now
      })
      throw error
    }
  }

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_group_refund',
    targetType: 'package_group',
    targetId: group.id,
    detail: {
      package_group_id: group.id,
      order_ids: orderIds,
      refund_reason: normalizedReason,
      previous_status: group.status,
      next_status: 'refund_pending'
    },
    ip
  })

  return {
    package_group_id: group.id,
    status: 'refund_pending',
    order_ids: orderIds
  }
}

const syncAdminPackageOrderRefundStatus = async ({ orderId, admin = {}, ip = null, now = new Date() }) => {
  ensureMySqlMode()

  const order = await ordersRepository.findOrderById(orderId)
  ensureFound(order, {
    responseCode: 2003,
    message: '订单不存在'
  })
  ensureCondition(Number(order.order_type) === 2, {
    responseCode: 2003,
    statusCode: 400,
    message: '订单不是课包拼团订单'
  })
  ensureCondition(['success', 'refund_pending', 'refund_failed', 'refunded'].includes(order.status), {
    responseCode: 2006,
    statusCode: 400,
    message: '只有已支付或退款相关状态的订单才允许同步退款状态'
  })

  const syncResult = await queryAndSyncCloudPayRefund({
    orderId: order.id,
    outRefundNo: buildPackageRefundOutRefundNo(order)
  })

  if (order.status !== 'refund_pending' && syncResult.finalStatus === 'refund_pending') {
    await ordersRepository.updateOrder(order.id, {
      status: 'refund_pending',
      updated_at: now
    })

    const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(order.id)
    if (paymentRecord) {
      const existingCallbackPayload =
        paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
          ? paymentRecord.callback_payload
          : {}
      await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
        status: 'refund_pending',
        callback_status: 'REFUND_PENDING',
        callback_payload: {
          ...existingCallbackPayload,
          refund_pending: {
            out_refund_no: buildPackageRefundOutRefundNo(order),
            synced_at: now.toISOString()
          }
        },
        updated_at: now.toISOString()
      })
    }
  }

  const latestOrder = await ordersRepository.findOrderById(order.id)

  await safeWriteAdminLog({
    adminId: admin.id,
    action: 'package_order_refund_sync',
    targetType: 'order',
    targetId: order.id,
    detail: {
      order_no: order.order_no || order.id,
      previous_status: order.status,
      next_status: latestOrder ? latestOrder.status : order.status,
      refund_query_status: syncResult.queryStatus || '',
      refund_query_settled: !!syncResult.settled,
      refund_query_final_status: syncResult.finalStatus || ''
    },
    ip
  })

  return {
    id: order.id,
    status: latestOrder ? latestOrder.status : order.status,
    out_refund_no: buildPackageRefundOutRefundNo(order),
    refund_query_status: syncResult.queryStatus || '',
    refund_query_settled: !!syncResult.settled,
    refund_query_final_status: syncResult.finalStatus || '',
    updated_at: latestOrder && latestOrder.updated_at ? formatDateTime(latestOrder.updated_at) : formatDateTime(now)
  }
}

module.exports = {
  createAdminPackage,
  geocodePackageAddress,
  getAdminPackageGroupDetail,
  getAdminPackageDetail,
  listAdminPackageGroups,
  listAdminPackageOrders,
  listAdminPackages,
  offlineAdminPackage,
  refundAdminPackageGroup,
  refundAdminPackageOrder,
  syncAdminPackageOrderRefundStatus,
  searchPackageLocations,
  updateAdminPackage,
  updateAdminPackageGroupCoachAssignment
}
