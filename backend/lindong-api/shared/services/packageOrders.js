const { env } = require('../../config/env')
const { withTransaction } = require('../../config/db')
const { coursePackagesRepository, ordersRepository, packageGroupsRepository, paymentRecordsRepository } = require('../../repositories')
const {
  PACKAGE_GROUP_STATUS,
  assertSupportedTargetCount,
  buildPackageDeadlineFromPackage,
  buildPackageGroupCreationPayload,
  calculatePackageMemberAmountFen,
  computePackageGroupNextStatus,
  isPackageGroupJoinable
} = require('../domain/packageGroupRules')

const {
  buildPackageLessonSchedule,
  computeFirstPackageClassTime,
  formatPackageDateTime,
  normalizeCustomScheduleList,
  normalizeScheduleType,
  normalizeTimeText,
  normalizeWeekday,
  normalizeWeekdays,
  SCHEDULE_TYPES
} = require('./packageSchedule')
const { formatShanghaiDateTime, parseShanghaiDate } = require('../utils/dateTime')
const { toDbDateTime } = require('../../repositories/_helpers')
const { AUTO_REFUND_REASON } = require('../constants/refunds')
const { enqueueGroupResultNotifications } = require('./groupResultNotifications')
const { cleanupExpiredPackageGroups, closePendingPackageOrdersByIds, listPendingOrderIdsForPackage } = require('./packageGroupStore')
const { createPackageServiceError, isPackageServiceError } = require('./packageServiceError')
const { createWechatPayRefund } = require('./wechatMiniProgram')

const PACKAGE_CAPACITY_REFUND_REASON = '拼团名额不足，系统自动退款'

const parseJsonObject = value => {
  if (!value) {
    return {}
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const loadOrderForUserForUpdate = async ({ transaction, userId, orderId }) => {
  const rows = await transaction.query(
    `
      select
        id, order_no, user_id, order_type, package_id, package_group_id, package_action, package_context,
        amount, status, created_at, updated_at, pay_time, refund_time, refund_reason, refund_operator_id, transaction_id
      from orders
      where id = ?
        and user_id = ?
      limit 1
      for update
    `,
    [orderId, userId]
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    ...row,
    order_type: Number(row.order_type) || 0,
    amount: Number(row.amount) || 0,
    package_context: parseJsonObject(row.package_context)
  }
}

const loadPackageGroupForUpdate = async ({ transaction, packageGroupId }) => {
  const rows = await transaction.query(
    `
      select
        id, package_id, creator_id, target_count, current_count, status, weekday, hour,
        first_class_time, deadline, created_at, success_time, schedule_config
      from package_groups
      where id = ?
      limit 1
      for update
    `,
    [packageGroupId]
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    ...row,
    target_count: Number(row.target_count) || 0,
    current_count: Number(row.current_count) || 0,
    weekday: Number(row.weekday) || 0,
    hour: Number(row.hour) || 0,
    schedule_config: row.schedule_config ? parseJsonObject(row.schedule_config) : null
  }
}

const loadPaymentRecordForUpdate = async ({ transaction, orderId }) => {
  const rows = await transaction.query(
    `
      select
        id, order_id, out_trade_no, transaction_id, amount, status, callback_status, callback_payload, closed_at
      from payment_records
      where order_id = ?
      limit 1
      for update
    `,
    [orderId]
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    ...row,
    amount: Number(row.amount) || 0,
    callback_payload: parseJsonObject(row.callback_payload)
  }
}

const markPackageOrderRaceRefundPending = async ({ transaction, order, paymentRecord, reason, now = new Date() }) => {
  const timestamp = now.toISOString()
  const dbTimestamp = toDbDateTime(now)

  await transaction.execute(
    `
      update orders
      set status = ?, refund_reason = ?, updated_at = ?
      where id = ?
    `,
    ['refund_pending', reason, dbTimestamp, order.id]
  )

  if (!paymentRecord) {
    return
  }

  const nextCallbackPayload = {
    ...paymentRecord.callback_payload,
    refund_pending: {
      ...(paymentRecord.callback_payload.refund_pending || {}),
      started_at: timestamp,
      reason
    }
  }

  await transaction.execute(
    `
      update payment_records
      set status = ?, callback_status = ?, callback_payload = ?, updated_at = ?
      where id = ?
    `,
    ['refund_pending', 'REFUND_PENDING', JSON.stringify(nextCallbackPayload), dbTimestamp, paymentRecord.id]
  )
}

const markPackageOrderRaceRefundFailed = async ({ orderId, reason, payload = {}, now = new Date() }) => {
  const timestamp = now.toISOString()

  const order = await ordersRepository.findOrderById(orderId)
  if (order) {
    await ordersRepository.updateOrder(order.id, {
      status: 'refund_failed',
      refund_reason: reason,
      updated_at: now
    })
  }

  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
  if (!paymentRecord) {
    return
  }

  const existingCallbackPayload =
    paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
      ? paymentRecord.callback_payload
      : {}

  await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    status: 'refund_failed',
    callback_status: 'REFUND_FAILED',
    callback_payload: {
      ...existingCallbackPayload,
      refund_failure: {
        reason: `${reason || ''}`.trim(),
        failed_at: timestamp,
        payload
      }
    },
    updated_at: timestamp
  })
}

const requestPackageOrderAutoRefund = async ({ orderId, reason, now = new Date() }) => {
  const { prepareCloudPayRefund } = require('./paymentShell')

  try {
    const prepared = await prepareCloudPayRefund({
      supabase: null,
      orderId,
      reason
    })

    const refundResult = await createWechatPayRefund({
      outTradeNo: prepared.outTradeNo,
      outRefundNo: prepared.outRefundNo,
      reason: prepared.refundDesc || reason,
      totalFee: prepared.totalFee,
      refundFee: prepared.refundFee
    })

    try {
      const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(orderId)
      if (paymentRecord) {
        const existingCallbackPayload =
          paymentRecord.callback_payload && typeof paymentRecord.callback_payload === 'object'
            ? paymentRecord.callback_payload
            : {}
        await paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
          callback_payload: {
            ...existingCallbackPayload,
            refund_pending: {
              ...(existingCallbackPayload.refund_pending || {}),
              out_refund_no: prepared.outRefundNo,
              started_at:
                (existingCallbackPayload.refund_pending && existingCallbackPayload.refund_pending.started_at) ||
                now.toISOString(),
              reason
            }
          },
          updated_at: now.toISOString()
        })
      }
    } catch (metadataError) {
      console.error('[packageOrders] failed to attach refund pending metadata after refund accepted', {
        orderId,
        error: metadataError
      })
    }

    return {
      status: 'refund_pending',
      refundResult
    }
  } catch (error) {
    await markPackageOrderRaceRefundFailed({
      orderId,
      reason: error && error.message ? error.message : reason || AUTO_REFUND_REASON,
      payload: error && error.payload ? error.payload : {},
      now
    })

    return {
      status: 'refund_failed',
      error: error && error.message ? error.message : String(error)
    }
  }
}

const ensureMySqlMode = () => {
  if (!env.useMySqlRepositories) {
    throw createPackageServiceError(501, 5000, 'package group is only supported in mysql mode')
  }
}

const getPackageByIdOrThrow = async packageId => {
  const pkg = await coursePackagesRepository.findPackageById(packageId)
  if (!pkg) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }

  return pkg
}

const resolvePackageClassCount = pkg => Math.max(1, Number(pkg && pkg.class_count) || 0)

const buildScheduleMinDate = now => {
  const shanghaiDateText = formatShanghaiDateTime(now).slice(0, 10)
  const minDate = parseShanghaiDate(`${shanghaiDateText} 00:00:00`)
  if (!minDate) {
    return null
  }

  minDate.setDate(minDate.getDate() + 3)
  return minDate
}

const formatDateOnly = value => {
  const date = parseShanghaiDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
}

const validateScheduleDateAtOrAfterMin = ({ scheduleDate, now = new Date() }) => {
  const selectedDate = scheduleDate ? parseShanghaiDate(`${scheduleDate} 00:00:00`) : null
  if (!selectedDate) {
    throw createPackageServiceError(400, 1001, '请填写正确的上课日期')
  }

  const minDate = buildScheduleMinDate(now)
  if (!minDate) {
    throw createPackageServiceError(400, 1001, '请填写正确的上课日期')
  }

  if (selectedDate.getTime() < minDate.getTime()) {
    throw createPackageServiceError(400, 1001, '上课日期不能早于开团后第3天')
  }
}

const validateScheduleTime = value => {
  const normalizedTime = normalizeTimeText(value)
  if (!normalizedTime) {
    throw createPackageServiceError(400, 1001, '请选择正确的上课时间')
  }

  const [hour] = normalizedTime.split(':').map(Number)
  if (hour < 9 || hour > 19) {
    throw createPackageServiceError(400, 1001, '请选择正确的上课时间')
  }

  return normalizedTime
}

const normalizeScheduleConfig = ({
  classCount,
  scheduleType,
  scheduleDate,
  scheduleTime,
  scheduleDays,
  scheduleList,
  now = new Date()
}) => {
  const totalCount = Math.max(1, Number(classCount) || 0)
  const normalizedType = normalizeScheduleType(scheduleType)
  const normalizedTime = validateScheduleTime(scheduleTime)
  const normalizedWeekdays = normalizeWeekdays(scheduleDays)
  const normalizedScheduleList = normalizeCustomScheduleList(scheduleList)

  if (normalizedScheduleList.length) {
    if (normalizedScheduleList.length !== totalCount) {
      throw createPackageServiceError(400, 1001, '请为每节课选择上课日期和时间')
    }

    normalizedScheduleList.forEach(item => {
      const classDate = parseShanghaiDate(item.class_time)
      const normalizedDate = classDate ? formatDateOnly(classDate) : ''
      validateScheduleDateAtOrAfterMin({
        scheduleDate: normalizedDate,
        now
      })
      validateScheduleTime(`${item.class_time}`.slice(11, 16))
    })
  }

  if (totalCount === 1) {
    if (normalizedType !== SCHEDULE_TYPES.SINGLE) {
      throw createPackageServiceError(400, 1001, '单节课必须选择具体上课日期')
    }

    validateScheduleDateAtOrAfterMin({
      scheduleDate,
      now
    })

    return {
      schedule_type: SCHEDULE_TYPES.SINGLE,
      schedule_date: `${scheduleDate}`.trim(),
      schedule_time: normalizedTime,
      schedule_days: [],
      class_count: 1,
      schedule_list: normalizedScheduleList
    }
  }

  if (![SCHEDULE_TYPES.DAILY, SCHEDULE_TYPES.WEEKLY].includes(normalizedType)) {
    throw createPackageServiceError(400, 1001, '请选择上课频率')
  }

  if (normalizedType === SCHEDULE_TYPES.DAILY) {
    validateScheduleDateAtOrAfterMin({
      scheduleDate,
      now
    })

    return {
      schedule_type: SCHEDULE_TYPES.DAILY,
      schedule_date: `${scheduleDate}`.trim(),
      schedule_time: normalizedTime,
      schedule_days: [],
      class_count: totalCount,
      schedule_list: normalizedScheduleList
    }
  }

  const maxWeeklySelections = totalCount >= 3 ? 3 : 2
  if (!normalizedWeekdays.length || normalizedWeekdays.length > maxWeeklySelections) {
    throw createPackageServiceError(
      400,
      1001,
      maxWeeklySelections === 2 ? '请选择每周1次或每周2次的上课星期' : '请选择每周1次、2次或3次的上课星期'
    )
  }

  const anchorDate = formatDateOnly(buildScheduleMinDate(now))

  return {
    schedule_type: SCHEDULE_TYPES.WEEKLY,
    schedule_date: anchorDate,
    schedule_time: normalizedTime,
    schedule_days: normalizedWeekdays,
    class_count: totalCount,
    schedule_list: normalizedScheduleList
  }
}

const buildScheduleSnapshotFields = scheduleConfig => {
  const normalized = scheduleConfig && typeof scheduleConfig === 'object' ? scheduleConfig : {}
  const normalizedType = normalizeScheduleType(normalized.schedule_type || normalized.scheduleType)
  const normalizedTime = normalizeTimeText(normalized.schedule_time || normalized.scheduleTime)
  const normalizedDays = normalizeWeekdays(normalized.schedule_days || normalized.scheduleDays)
  const normalizedScheduleList = normalizeCustomScheduleList(normalized.schedule_list || normalized.scheduleList)

  return {
    schedule_type: normalizedType,
    schedule_date: `${normalized.schedule_date || normalized.scheduleDate || ''}`.trim(),
    schedule_time: normalizedTime,
    schedule_days: normalizedDays,
    class_count: Math.max(1, Number(normalized.class_count || normalized.classCount) || 0),
    schedule_list: normalizedScheduleList
  }
}

const buildPackageOrderContext = ({
  targetCount = 0,
  scheduleConfig = null,
  childProfile = {},
  existingContext = {}
}) => {
  const snapshot = buildScheduleSnapshotFields(scheduleConfig)
  const hasScheduleSnapshot = !!snapshot.schedule_type

  return {
    ...existingContext,
    target_count: Number(targetCount) || 0,
    weekday:
      snapshot.schedule_type === SCHEDULE_TYPES.WEEKLY && snapshot.schedule_days.length === 1
        ? snapshot.schedule_days[0]
        : 0,
    class_date: snapshot.schedule_type === SCHEDULE_TYPES.SINGLE ? snapshot.schedule_date : '',
    hour: Number((snapshot.schedule_time || '00:00').split(':')[0]) || 0,
    schedule_type: snapshot.schedule_type,
    schedule_date: snapshot.schedule_date,
    schedule_time: snapshot.schedule_time,
    schedule_days: snapshot.schedule_days,
    class_count: snapshot.class_count,
    schedule_list: snapshot.schedule_list,
    schedule_config: hasScheduleSnapshot ? snapshot : null,
    child_nickname: childProfile.childNickname || '',
    child_age: childProfile.childAge === null || childProfile.childAge === undefined ? null : childProfile.childAge,
    parent_mobile: childProfile.parentMobile || ''
  }
}

const buildScheduleConfigFromContext = ({ context = {}, pkg, now = new Date() }) => {
  const totalCount = resolvePackageClassCount(pkg)
  const scheduleConfig = parseJsonObject(context.schedule_config)
  if (scheduleConfig && scheduleConfig.schedule_type) {
    return normalizeScheduleConfig({
      classCount: totalCount,
      scheduleType: scheduleConfig.schedule_type,
      scheduleDate: scheduleConfig.schedule_date,
      scheduleTime: scheduleConfig.schedule_time,
      scheduleDays: scheduleConfig.schedule_days,
      scheduleList: scheduleConfig.schedule_list,
      now
    })
  }

  const weekday = normalizeWeekday(context.weekday || context.schedule_day)
  const legacyClassDate = `${context.class_date || context.classDate || ''}`.trim()
  const legacyTime = context.schedule_time || context.scheduleTime || (context.hour !== undefined ? `${context.hour}:00` : '')

  return normalizeScheduleConfig({
    classCount: totalCount,
    scheduleType: totalCount === 1 ? SCHEDULE_TYPES.SINGLE : SCHEDULE_TYPES.WEEKLY,
    scheduleDate: totalCount === 1 ? legacyClassDate : formatDateOnly(buildScheduleMinDate(now)),
    scheduleTime: legacyTime,
    scheduleDays: weekday ? [weekday] : [],
    now
  })
}

const normalizeChildNickname = value => `${value || ''}`.trim()

const normalizeParentMobile = value => `${value ?? ''}`.replace(/\D/g, '').slice(0, 11)

const normalizeChildAge = value => {
  const trimmed = `${value ?? ''}`.trim()
  if (!trimmed) {
    return null
  }

  if (!/^\d+$/.test(trimmed)) {
    return NaN
  }

  return Number(trimmed)
}

const validateChildProfile = ({ childNickname, childAge, parentMobile }) => {
  const normalizedNickname = normalizeChildNickname(childNickname)
  if (!normalizedNickname) {
    throw createPackageServiceError(400, 1001, '请填写孩子昵称')
  }

  const normalizedAge = normalizeChildAge(childAge)
  if (!Number.isInteger(normalizedAge) || normalizedAge < 0) {
    throw createPackageServiceError(400, 1001, '请填写孩子年龄')
  }

  const normalizedParentMobile = normalizeParentMobile(parentMobile)
  if (!/^1\d{10}$/.test(normalizedParentMobile)) {
    throw createPackageServiceError(400, 1001, '请填写正确的家长手机号')
  }

  return {
    childNickname: normalizedNickname,
    childAge: normalizedAge,
    parentMobile: normalizedParentMobile
  }
}

const createPackageStartOrder = async ({
  userId,
  packageId,
  targetCount,
  scheduleType,
  scheduleDate,
  scheduleDays,
  scheduleTime,
  scheduleList,
  childNickname,
  childAge,
  parentMobile,
  now = new Date()
}) => {
  ensureMySqlMode()
  const normalizedChildProfile = validateChildProfile({
    childNickname,
    childAge,
    parentMobile
  })

  const pkg = await getPackageByIdOrThrow(packageId)
  if (Number(pkg.status) !== 1) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }
  const classCount = resolvePackageClassCount(pkg)
  const normalizedScheduleConfig = normalizeScheduleConfig({
    classCount,
    scheduleType,
    scheduleDate,
    scheduleTime,
    scheduleDays,
    scheduleList,
    now
  })

  assertSupportedTargetCount({
    supportedPeople: pkg.supported_people,
    targetCount
  })

  await cleanupExpiredPackageGroups({
    packageId,
    now
  })

  await closePendingPackageOrdersByIds({
    orderIds: await listPendingOrderIdsForPackage({
      userId,
      packageId
    }),
    now
  })

  const memberAmountFen = calculatePackageMemberAmountFen({
    totalPrice: pkg.total_price,
    targetCount,
    groupPriceConfig: pkg.group_price_config
  })

  const order = await ordersRepository.createOrder({
    user_id: userId,
    order_type: 2,
    package_id: packageId,
    package_action: 'start',
    package_context: buildPackageOrderContext({
      targetCount,
      scheduleConfig: normalizedScheduleConfig,
      childProfile: normalizedChildProfile
    }),
    amount: memberAmountFen
  })

  return {
    order,
    package: pkg,
    memberAmountFen,
    scheduleConfig: normalizedScheduleConfig,
    childNickname: normalizedChildProfile.childNickname,
    childAge: normalizedChildProfile.childAge,
    parentMobile: normalizedChildProfile.parentMobile
  }
}

const createPackageJoinOrder = async ({
  userId,
  packageId,
  packageGroupId,
  childNickname,
  childAge,
  parentMobile,
  now = new Date()
}) => {
  ensureMySqlMode()
  const normalizedChildProfile = validateChildProfile({
    childNickname,
    childAge,
    parentMobile
  })

  const pkg = await getPackageByIdOrThrow(packageId)
  if (Number(pkg.status) !== 1) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }

  await cleanupExpiredPackageGroups({
    packageId,
    now
  })

  const group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  if (!group || group.package_id !== packageId) {
    throw createPackageServiceError(404, 2002, '拼团不存在')
  }

  if (!isPackageGroupJoinable(group, now)) {
    throw createPackageServiceError(400, 2005, '拼团已满员或已截止')
  }

  await closePendingPackageOrdersByIds({
    orderIds: await listPendingOrderIdsForPackage({
      userId,
      packageId
    }),
    now
  })

  const memberAmountFen = calculatePackageMemberAmountFen({
    totalPrice: pkg.total_price,
    targetCount: group.target_count,
    groupPriceConfig: pkg.group_price_config
  })
  const normalizedScheduleConfig = group.schedule_config
    ? normalizeScheduleConfig({
        classCount: resolvePackageClassCount(pkg),
        scheduleType: group.schedule_config.schedule_type,
        scheduleDate: group.schedule_config.schedule_date,
        scheduleTime: group.schedule_config.schedule_time,
        scheduleDays: group.schedule_config.schedule_days,
        scheduleList: buildPackageLessonSchedule({
          scheduleConfig: group.schedule_config,
          firstClassTime: group.first_class_time,
          weeks: resolvePackageClassCount(pkg)
        }),
        now
      })
    : null

  const order = await ordersRepository.createOrder({
    user_id: userId,
    order_type: 2,
    package_id: packageId,
    package_group_id: packageGroupId,
    package_action: 'join',
    package_context: buildPackageOrderContext({
      targetCount: group.target_count,
      scheduleConfig: normalizedScheduleConfig,
      childProfile: normalizedChildProfile
    }),
    amount: memberAmountFen
  })

  return {
    order,
    package: pkg,
    group,
    memberAmountFen,
    childNickname: normalizedChildProfile.childNickname,
    childAge: normalizedChildProfile.childAge,
    parentMobile: normalizedChildProfile.parentMobile
  }
}

const resolveOrderGroupSummary = async order => {
  const group = order.package_group_id ? await packageGroupsRepository.findPackageGroupById(order.package_group_id) : null

  return {
    packageGroupId: group ? group.id : order.package_group_id || null,
    groupStatus: group ? group.status : PACKAGE_GROUP_STATUS.FAILED,
    scheduleList: group
      ? buildPackageLessonSchedule({
          scheduleConfig: group.schedule_config,
          firstClassTime: group.first_class_time,
          weeks: order && order.package_context && order.package_context.schedule_config
            ? Number(order.package_context.schedule_config.class_count) || 0
            : undefined
        })
      : buildPackageLessonSchedule({
          scheduleConfig: order && order.package_context && order.package_context.schedule_config
            ? order.package_context.schedule_config
            : null,
          scheduleList: order && order.package_context && order.package_context.schedule_list
            ? order.package_context.schedule_list
            : [],
          weeks:
            order && order.package_context && order.package_context.schedule_config
              ? Number(order.package_context.schedule_config.class_count) || 0
              : undefined
        }),
    firstClassTime: group && group.first_class_time
      ? formatPackageDateTime(group.first_class_time)
      : (() => {
          const fallbackScheduleList = buildPackageLessonSchedule({
            scheduleConfig: order && order.package_context && order.package_context.schedule_config
              ? order.package_context.schedule_config
              : null,
            scheduleList: order && order.package_context && order.package_context.schedule_list
              ? order.package_context.schedule_list
              : [],
            weeks:
              order && order.package_context && order.package_context.schedule_config
                ? Number(order.package_context.schedule_config.class_count) || 0
                : undefined
          })
          return fallbackScheduleList[0] ? fallbackScheduleList[0].class_time : null
        })()
  }
}

const findStartGroupBySourceOrder = async ({ order }) => {
  if (!order || !order.id || !order.package_id || !order.user_id) {
    return null
  }

  const groups = await packageGroupsRepository.listPackageGroups({
    packageId: order.package_id,
    creatorId: order.user_id
  })

  return (
    (groups || []).find(group => {
      const scheduleConfig = group && group.schedule_config && typeof group.schedule_config === 'object' ? group.schedule_config : {}
      return (
        `${scheduleConfig.source_order_id || ''}`.trim() === order.id ||
        (`${scheduleConfig.source_order_no || ''}`.trim() && `${scheduleConfig.source_order_no || ''}`.trim() === `${order.order_no || ''}`.trim())
      )
    }) || null
  )
}

const syncOrderPaymentRecordGroupId = async ({ order, packageGroupId, now = new Date() }) => {
  if (!order || !packageGroupId) {
    return null
  }

  if (!paymentRecordsRepository || typeof paymentRecordsRepository.findPaymentRecordByOrderId !== 'function') {
    return null
  }

  const paymentRecord = await paymentRecordsRepository.findPaymentRecordByOrderId(order.id)
  if (!paymentRecord || paymentRecord.package_group_id === packageGroupId) {
    return paymentRecord
  }

  return paymentRecordsRepository.updatePaymentRecord(paymentRecord.id, {
    package_group_id: packageGroupId,
    updated_at: now.toISOString()
  })
}

const markPackageOrderPaymentSuccess = async ({ userId, orderId, now = new Date() }) => {
  ensureMySqlMode()

  let order = await ordersRepository.findOrderForUser({
    userId,
    orderId
  })
  if (!order) {
    throw createPackageServiceError(404, 2003, '订单不存在')
  }

  if (Number(order.order_type) !== 2) {
    throw createPackageServiceError(400, 2006, '订单状态异常')
  }

  await cleanupExpiredPackageGroups({
    packageId: order.package_id,
    now
  })

  order = await ordersRepository.findOrderForUser({
    userId,
    orderId
  })
  if (!order) {
    throw createPackageServiceError(404, 2003, '订单不存在')
  }

  if (order.status === 'closed') {
    throw createPackageServiceError(400, 2006, '订单状态异常')
  }

  if (order.status === 'success') {
    const groupSummary = await resolveOrderGroupSummary(order)
    return {
      order,
      status: 'success',
      packageGroupId: groupSummary.packageGroupId,
      groupStatus: groupSummary.groupStatus,
      firstClassTime: groupSummary.firstClassTime,
      scheduleList: groupSummary.scheduleList
    }
  }

  if (order.status === 'refund_pending' || order.status === 'refund_failed' || order.status === 'refunded') {
    const groupSummary = await resolveOrderGroupSummary(order)
    return {
      order,
      status: order.status,
      packageGroupId: groupSummary.packageGroupId,
      groupStatus: groupSummary.groupStatus,
      firstClassTime: groupSummary.firstClassTime,
      scheduleList: groupSummary.scheduleList
    }
  }

  const pkg = await getPackageByIdOrThrow(order.package_id)

  if (order.package_action === 'start') {
    const context = order.package_context || {}
    const targetCount = Number(context.target_count || context.targetCount || 0)
    const normalizedScheduleConfig = buildScheduleConfigFromContext({
      context,
      pkg,
      now
    })
    assertSupportedTargetCount({
      supportedPeople: pkg.supported_people,
      targetCount
    })

    const deadline = buildPackageDeadlineFromPackage({
      createdAt: now,
      pkg
    })
    const nextStatus =
      Number(targetCount) <= 1 ? PACKAGE_GROUP_STATUS.SUCCESS : PACKAGE_GROUP_STATUS.ACTIVE
    const firstClassTime =
      nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
        ? computeFirstPackageClassTime({
            successTime: now,
            scheduleConfig: normalizedScheduleConfig,
            classCount: normalizedScheduleConfig.class_count
          })
        : null

    const existingGroup = await findStartGroupBySourceOrder({
      order
    })
    const group =
      existingGroup ||
      (await packageGroupsRepository.createPackageGroup(
        buildPackageGroupCreationPayload({
          packageId: pkg.id,
          creatorId: userId,
          targetCount,
          weekday:
            normalizedScheduleConfig.schedule_type === SCHEDULE_TYPES.WEEKLY && normalizedScheduleConfig.schedule_days.length === 1
              ? normalizedScheduleConfig.schedule_days[0]
              : 0,
          hour: Number((normalizedScheduleConfig.schedule_time || '00:00').split(':')[0]) || 0,
          scheduleConfig: {
            ...normalizedScheduleConfig,
            source_order_id: order.id,
            source_order_no: order.order_no || ''
          },
          deadline,
          currentCount: 1,
          status: nextStatus,
          firstClassTime,
          successTime: nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? now : null,
          createdAt: now
        })
      ))

    const updatedOrder = await ordersRepository.updateOrder(order.id, {
      status: 'success',
      package_group_id: group.id,
      package_context: buildPackageOrderContext({
        targetCount,
        scheduleConfig: normalizedScheduleConfig,
        childProfile: {
          childNickname: context.child_nickname || '',
          childAge:
            context.child_age === null || context.child_age === undefined
              ? null
              : Number(context.child_age) || 0,
          parentMobile: context.parent_mobile || ''
        },
        existingContext: context
      }),
      pay_time: now,
      updated_at: now
    })
    await syncOrderPaymentRecordGroupId({
      order: updatedOrder,
      packageGroupId: group.id,
      now
    })

    if (!existingGroup && group.status === PACKAGE_GROUP_STATUS.SUCCESS) {
      await enqueueGroupResultNotifications({
        supabase: null,
        groupId: group.id,
        resultType: 'success',
        now
      })
    }

    return {
      order: updatedOrder,
      status: 'success',
      packageGroupId: group.id,
      groupStatus: group.status,
      firstClassTime: group.first_class_time ? formatPackageDateTime(group.first_class_time) : null,
      scheduleList: buildPackageLessonSchedule({
        scheduleConfig: group.schedule_config,
        firstClassTime: group.first_class_time,
        weeks: normalizedScheduleConfig.class_count
      })
    }
  }

  if (order.package_action === 'join') {
    const transition = await withTransaction(async transaction => {
      const lockedOrder = await loadOrderForUserForUpdate({
        transaction,
        userId,
        orderId
      })
      if (!lockedOrder) {
        throw createPackageServiceError(404, 2003, '订单不存在')
      }

      if (lockedOrder.status === 'success') {
        return {
          status: 'success',
          orderId: lockedOrder.id,
          packageGroupId: lockedOrder.package_group_id,
          promotedToSuccess: false
        }
      }

      if (lockedOrder.status === 'refund_pending' || lockedOrder.status === 'refund_failed' || lockedOrder.status === 'refunded') {
        return {
          status: lockedOrder.status,
          orderId: lockedOrder.id,
          packageGroupId: lockedOrder.package_group_id,
          promotedToSuccess: false
        }
      }

      if (lockedOrder.status === 'closed') {
        throw createPackageServiceError(400, 2006, '订单状态异常')
      }

      const lockedGroup = await loadPackageGroupForUpdate({
        transaction,
        packageGroupId: lockedOrder.package_group_id
      })
      if (!lockedGroup) {
        throw createPackageServiceError(404, 2002, '拼团不存在')
      }

      if (!isPackageGroupJoinable(lockedGroup, now)) {
        const lockedPaymentRecord = await loadPaymentRecordForUpdate({
          transaction,
          orderId: lockedOrder.id
        })

        await markPackageOrderRaceRefundPending({
          transaction,
          order: lockedOrder,
          paymentRecord: lockedPaymentRecord,
          reason: PACKAGE_CAPACITY_REFUND_REASON,
          now
        })

        return {
          status: 'refund_pending',
          orderId: lockedOrder.id,
          packageGroupId: lockedGroup.id,
          refundReason: PACKAGE_CAPACITY_REFUND_REASON,
          requiresRefund: true,
          promotedToSuccess: false
        }
      }

      const nextCount = Number(lockedGroup.current_count) + 1
      const nextStatus = computePackageGroupNextStatus({
        currentCount: nextCount,
        targetCount: lockedGroup.target_count,
        deadline: lockedGroup.deadline,
        now
      })
      const firstClassTime =
        nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
          ? computeFirstPackageClassTime({
              successTime: now,
              scheduleConfig: lockedGroup.schedule_config
            })
          : null

      await transaction.execute(
        `
          update orders
          set status = ?, pay_time = ?, updated_at = ?
          where id = ?
        `,
        ['success', toDbDateTime(now), toDbDateTime(now), lockedOrder.id]
      )
      await transaction.execute(
        `
          update package_groups
          set current_count = ?, status = ?, success_time = ?, first_class_time = ?
          where id = ?
        `,
        [
          nextCount,
          nextStatus,
          nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? toDbDateTime(now) : lockedGroup.success_time || null,
          nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? toDbDateTime(firstClassTime) : lockedGroup.first_class_time || null,
          lockedGroup.id
        ]
      )

      return {
        status: 'success',
        orderId: lockedOrder.id,
        packageGroupId: lockedGroup.id,
        promotedToSuccess: true,
        groupWasSuccess: lockedGroup.status === PACKAGE_GROUP_STATUS.SUCCESS,
        groupNowSuccess: nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
      }
    })

    if (transition.requiresRefund) {
      await requestPackageOrderAutoRefund({
        orderId: transition.orderId,
        reason: transition.refundReason || PACKAGE_CAPACITY_REFUND_REASON,
        now
      })
    }

    const updatedOrder = await ordersRepository.findOrderById(transition.orderId)
    const updatedGroup = transition.packageGroupId
      ? await packageGroupsRepository.findPackageGroupById(transition.packageGroupId)
      : null

    if (
      transition.promotedToSuccess &&
      !transition.groupWasSuccess &&
      transition.groupNowSuccess &&
      updatedGroup
    ) {
      await enqueueGroupResultNotifications({
        supabase: null,
        groupId: updatedGroup.id,
        resultType: 'success',
        now
      })
    }

    return {
      order: updatedOrder,
      status: updatedOrder ? updatedOrder.status : transition.status,
      packageGroupId: updatedGroup ? updatedGroup.id : transition.packageGroupId || '',
      groupStatus: updatedGroup ? updatedGroup.status : PACKAGE_GROUP_STATUS.FAILED,
      firstClassTime: updatedGroup && updatedGroup.first_class_time ? formatPackageDateTime(updatedGroup.first_class_time) : null,
      scheduleList: updatedGroup
        ? buildPackageLessonSchedule({
            scheduleConfig: updatedGroup.schedule_config,
            firstClassTime: updatedGroup.first_class_time
          })
        : []
    }
  }

  throw createPackageServiceError(400, 2006, '订单状态异常')
}

module.exports = {
  createPackageJoinOrder,
  createPackageStartOrder,
  isPackageServiceError,
  markPackageOrderPaymentSuccess
}
