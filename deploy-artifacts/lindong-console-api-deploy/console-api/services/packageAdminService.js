const { env } = require('../../config/env')
const {
  coursePackagesRepository,
  ordersRepository,
  packageGroupsRepository,
  usersRepository
} = require('../../repositories')
const { calculatePackageMemberAmountFen } = require('../../shared/domain/packageGroupRules')
const { AUTO_REFUND_REASON } = require('../../shared/constants/refunds')
const { cleanupExpiredPackageGroups, closePendingPackageOrdersByIds } = require('../../shared/services/packageGroupStore')
const {
  buildPackageLessonSchedule,
  formatPackageDateTime,
  formatPendingPackageScheduleText
} = require('../../shared/services/packageSchedule')
const { buildAdminLocationText, formatFenText } = require('../../shared/services/packageReaders')
const { markPaymentRecordRefunded } = require('../../shared/services/paymentShell')
const { writeAdminLog } = require('../../utils/adminStore')
const { formatDateTime, getPagination } = require('../routes/_helpers')
const { ensureCondition, ensureFound } = require('./_guards')

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

const toMap = (list = [], key = 'id') =>
  list.reduce((result, item) => {
    result[item[key]] = item
    return result
  }, {})

const normalizeText = value => `${value || ''}`.trim()

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

const normalizePackageStatus = (value, fallback = 1) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'number') {
    return value === 1 ? 1 : 0
  }

  const normalized = `${value}`.trim().toLowerCase()
  if (['1', 'active', 'online', 'enabled', '上架'].includes(normalized)) {
    return 1
  }

  if (['0', 'inactive', 'offline', 'disabled', '下架'].includes(normalized)) {
    return 0
  }

  return fallback
}

const normalizePackageStatusFilter = value => {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  return normalizePackageStatus(value, 1)
}

const mapPackageStatus = value => (Number(value) === 1 ? 'active' : 'inactive')

const normalizeSupportedPeople = value => coursePackagesRepository.normalizeSupportedPeople(value)
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
    ['cover', '封面图不能为空'],
    ['location_district', '所在区域不能为空'],
    ['location_community', '小区名称不能为空'],
    ['location_detail', '详细地点不能为空'],
    ['coach_name', '教练姓名不能为空'],
    ['coach_intro', '教练简介不能为空'],
    ['description', '课程介绍不能为空']
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

  if (!partial || payload.total_price_fen !== undefined || payload.total_price !== undefined) {
    const totalPrice = Number(payload.total_price_fen ?? payload.total_price)
    ensureCondition(Number.isFinite(totalPrice) && totalPrice > 0, {
      responseCode: 1001,
      statusCode: 400,
      message: '课包总价必须大于 0'
    })
  }

  if (!partial || payload.supported_people !== undefined) {
    const supportedPeople = normalizeSupportedPeople(payload.supported_people)
    ensureCondition(supportedPeople.length > 0, {
      responseCode: 1001,
      statusCode: 400,
      message: '支持的几人团选项不能为空'
    })
  }
}

const mapPackagePayloadToDb = ({ payload = {}, admin = {}, create = false }) => {
  const dbPayload = {}
  const assign = (target, source = target, transform = current => current) => {
    if (payload[source] === undefined) {
      return
    }

    dbPayload[target] = transform(payload[source])
  }

  assign('name', 'name', normalizeText)
  assign('package_category', 'package_category', normalizePackageCategory)
  assign('cover', 'cover', normalizeText)
  assign('images', 'images', value => (Array.isArray(value) ? value : []))
  assign('total_price', 'total_price_fen', value => Number(value) || 0)
  assign('total_price', 'total_price', value => Number(value) || 0)
  assign('supported_people', 'supported_people', normalizeSupportedPeople)
  assign('location_district', 'location_district', normalizeText)
  assign('location_community', 'location_community', normalizeText)
  assign('location_detail', 'location_detail', normalizeText)
  assign('longitude', 'longitude', normalizeOptionalNumber)
  assign('latitude', 'latitude', normalizeOptionalNumber)
  assign('coach_name', 'coach_name', normalizeText)
  assign('coach_intro', 'coach_intro', normalizeText)
  assign('coach_certificates', 'coach_certificates', value => (Array.isArray(value) ? value : []))
  assign('description', 'description', normalizeText)
  assign('deadline_hours', 'deadline_hours', value => Number(value) || 48)
  assign('status', 'status', value => normalizePackageStatus(value, create ? 1 : 0))

  if (create && dbPayload.status === undefined) {
    dbPayload.status = 1
  }

  if (create) {
    dbPayload.created_by = admin.id || null
  }

  dbPayload.updated_by = admin.id || null
  return dbPayload
}

const mapPackageListItem = item => ({
  id: item.id,
  name: item.name,
  cover: item.cover || '',
  total_price_fen: Number(item.total_price) || 0,
  total_price_text: formatFenText(item.total_price),
  package_category: item.package_category || '体适能',
  supported_people: item.supported_people || [],
  location_text: buildAdminLocationText(item),
  location_district: item.location_district || '',
  location_community: item.location_community || '',
  location_detail: item.location_detail || '',
  coach_name: item.coach_name || '',
  status: mapPackageStatus(item.status),
  deadline_hours: Number(item.deadline_hours) || 48,
  create_time: formatDateTime(item.created_at),
  update_time: formatDateTime(item.updated_at)
})

const mapPackageDetail = item => ({
  ...mapPackageListItem(item),
  images: item.images || [],
  longitude: item.longitude,
  latitude: item.latitude,
  coach_intro: item.coach_intro || '',
  coach_certificates: item.coach_certificates || [],
  description: item.description || '',
  created_by: item.created_by || '',
  updated_by: item.updated_by || ''
})

const listAdminPackages = async ({ query = {} }) => {
  ensureMySqlMode()

  const { page, size, from, to } = getPagination(query)
  const status = normalizePackageStatusFilter(query.status)
  const packages = await coursePackagesRepository.listPackages({
    keyword: normalizeText(query.keyword),
    category: normalizeText(query.package_category),
    status
  })

  return {
    total: packages.length,
    page,
    size,
    total_pages: Math.max(1, Math.ceil(packages.length / size)),
    list: packages.slice(from, to + 1).map(mapPackageListItem)
  }
}

const getAdminPackageDetail = async ({ packageId }) => {
  ensureMySqlMode()

  const pkg = await coursePackagesRepository.findPackageById(packageId)
  ensureFound(pkg, {
    responseCode: 2001,
    message: '课包不存在'
  })

  return mapPackageDetail(pkg)
}

const createAdminPackage = async ({ payload = {}, admin = {}, ip = null }) => {
  ensureMySqlMode()
  validatePackagePayload(payload)

  const created = await coursePackagesRepository.createPackage(
    mapPackagePayloadToDb({
      payload,
      admin,
      create: true
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
      status: mapPackageStatus(created.status),
      total_price_fen: Number(created.total_price) || 0,
      supported_people: created.supported_people || []
    },
    ip
  })

  return mapPackageDetail(created)
}

const updateAdminPackage = async ({ packageId, payload = {}, admin = {}, ip = null }) => {
  ensureMySqlMode()

  const existing = await coursePackagesRepository.findPackageById(packageId)
  ensureFound(existing, {
    responseCode: 2001,
    message: '课包不存在'
  })
  validatePackagePayload(payload, { partial: true })

  const updated = await coursePackagesRepository.updatePackage(
    packageId,
    mapPackagePayloadToDb({
      payload,
      admin
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
      previous_status: mapPackageStatus(existing.status),
      next_status: mapPackageStatus(updated.status),
      total_price_fen: Number(updated.total_price) || 0,
      supported_people: updated.supported_people || []
    },
    ip
  })

  return mapPackageDetail(updated)
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
    const memberAmountFen = calculatePackageMemberAmountFen({
      totalPrice: pkg.total_price,
      targetCount: group.target_count
    })
    const scheduleList = group.first_class_time
      ? buildPackageLessonSchedule({
          firstClassTime: group.first_class_time,
          weeks: 5
        })
      : []

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
      remaining_seconds:
        group.status === 'active'
          ? Math.max(0, Math.floor((new Date(group.deadline).getTime() - now.getTime()) / 1000))
          : 0,
      weekday: Number(group.weekday) || 0,
      hour: Number(group.hour) || 0,
      schedule_text: group.first_class_time
        ? `首课时间 ${formatPackageDateTime(group.first_class_time)}，共5次`
        : formatPendingPackageScheduleText({
            weekday: group.weekday,
            hour: group.hour
          }),
      first_class_time: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
      schedule_list: scheduleList,
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

const mapOrderStatus = status => status || 'pending'

const listAdminPackageOrders = async ({ query = {} }) => {
  ensureMySqlMode()

  const { page, size, from, to } = getPagination(query)
  const packageId = normalizeText(query.package_id)
  const status = normalizeText(query.status)
  const keyword = normalizeText(query.keyword)
  const orders = await ordersRepository.listOrders({
    orderType: 2,
    packageId,
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
        phone: '',
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

  const refundTime = now
  const updatedOrder = await ordersRepository.updateOrder(order.id, {
    status: 'refunded',
    refund_time: refundTime,
    refund_reason: normalizedReason,
    refund_operator_id: admin.id || null,
    updated_at: refundTime
  })
  const paymentRecord = await markPaymentRecordRefunded({
    supabase: null,
    orderId: order.id,
    reason: normalizedReason,
    now: refundTime
  })

  let groupDetail = null
  let closedPendingOrderIds = []

  if (group) {
    const remainingSuccessOrders = await ordersRepository.listOrdersByPackageGroupId({
      packageGroupId: group.id,
      status: 'success'
    })
    const nextCount = remainingSuccessOrders.length
    const nextStatus = group.status === 'active' && nextCount <= 0 ? 'failed' : group.status
    const updatedGroup = await packageGroupsRepository.updatePackageGroup(group.id, {
      current_count: nextCount,
      status: nextStatus
    })

    if (nextStatus === 'failed') {
      const pendingOrders = await ordersRepository.listOrdersByPackageGroupId({
        packageGroupId: group.id,
        status: 'pending'
      })
      const closedOrders = await closePendingPackageOrdersByIds({
        orderIds: pendingOrders.map(item => item.id).filter(Boolean),
        now: refundTime
      })
      closedPendingOrderIds = (closedOrders || []).map(item => item.id).filter(Boolean)
    }

    groupDetail = {
      id: updatedGroup.id,
      previous_status: group.status,
      next_status: updatedGroup.status,
      previous_count: Number(group.current_count) || 0,
      next_count: Number(updatedGroup.current_count) || 0
    }
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
      payment_record_status: paymentRecord ? paymentRecord.status : '',
      group_detail: groupDetail,
      closed_pending_order_ids: closedPendingOrderIds
    },
    ip
  })

  return {
    id: updatedOrder.id,
    status: updatedOrder.status,
    refund_time: formatDateTime(updatedOrder.refund_time),
    refund_reason: updatedOrder.refund_reason || '',
    payment_record_status: paymentRecord ? paymentRecord.status : '',
    group: groupDetail,
    closed_pending_order_ids: closedPendingOrderIds
  }
}

module.exports = {
  createAdminPackage,
  getAdminPackageDetail,
  listAdminPackageGroups,
  listAdminPackageOrders,
  listAdminPackages,
  refundAdminPackageOrder,
  updateAdminPackage
}
