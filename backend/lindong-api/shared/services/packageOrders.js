const { env } = require('../../config/env')
const { withTransaction } = require('../../config/db')
const { coursePackagesRepository, ordersRepository, packageGroupsRepository, paymentRecordsRepository } = require('../../repositories')
const {
  PACKAGE_GROUP_STATUS,
  assertSupportedTargetCount,
  buildPackageDeadline,
  buildPackageGroupCreationPayload,
  calculatePackageMemberAmountFen,
  computePackageGroupNextStatus,
  isPackageGroupJoinable
} = require('../domain/packageGroupRules')

const {
  buildPackageLessonSchedule,
  computeFirstPackageClassTime,
  formatPackageDateTime,
  normalizeHour,
  normalizeWeekday
} = require('./packageSchedule')
const { toDbDateTime } = require('../../repositories/_helpers')
const { AUTO_REFUND_REASON } = require('../constants/refunds')
const { enqueueGroupResultNotifications } = require('./groupResultNotifications')
const { cleanupExpiredPackageGroups, closePendingPackageOrdersByIds, listPendingOrderIdsForPackage } = require('./packageGroupStore')
const { createPackageServiceError, isPackageServiceError } = require('./packageServiceError')
const { createWechatPayRefund } = require('./wechatMiniProgram')

const TEMP_PACKAGE_GROUP_DEADLINE_MINUTES = 5
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
        first_class_time, deadline, created_at, success_time
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
    hour: Number(row.hour) || 0
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

const validateWeekdayAndHour = ({ weekday, hour }) => {
  if (!normalizeWeekday(weekday)) {
    throw createPackageServiceError(400, 1001, 'weekday 参数错误')
  }

  if (normalizeHour(hour) < 0) {
    throw createPackageServiceError(400, 1001, 'hour 参数错误')
  }
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
  weekday,
  hour,
  childNickname,
  childAge,
  parentMobile,
  now = new Date()
}) => {
  ensureMySqlMode()
  validateWeekdayAndHour({ weekday, hour })
  const normalizedChildProfile = validateChildProfile({
    childNickname,
    childAge,
    parentMobile
  })

  const pkg = await getPackageByIdOrThrow(packageId)
  if (Number(pkg.status) !== 1) {
    throw createPackageServiceError(404, 2001, '课包不存在')
  }

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
    package_context: {
      target_count: Number(targetCount),
      weekday: Number(weekday),
      hour: Number(hour),
      child_nickname: normalizedChildProfile.childNickname,
      child_age: normalizedChildProfile.childAge,
      parent_mobile: normalizedChildProfile.parentMobile
    },
    amount: memberAmountFen
  })

  return {
    order,
    package: pkg,
    memberAmountFen,
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

  const order = await ordersRepository.createOrder({
    user_id: userId,
    order_type: 2,
    package_id: packageId,
    package_group_id: packageGroupId,
    package_action: 'join',
    package_context: {
      child_nickname: normalizedChildProfile.childNickname,
      child_age: normalizedChildProfile.childAge,
      parent_mobile: normalizedChildProfile.parentMobile
    },
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
    scheduleList: group && group.first_class_time
      ? buildPackageLessonSchedule({
          firstClassTime: group.first_class_time,
          weeks: 5
        })
      : [],
    firstClassTime: group && group.first_class_time ? formatPackageDateTime(group.first_class_time) : null
  }
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
    const weekday = Number(context.weekday || 0)
    const hour = Number(context.hour || 0)

    validateWeekdayAndHour({ weekday, hour })
    assertSupportedTargetCount({
      supportedPeople: pkg.supported_people,
      targetCount
    })

    const deadline = buildPackageDeadline({
      createdAt: now,
      deadlineMinutes: TEMP_PACKAGE_GROUP_DEADLINE_MINUTES
    })
    const nextStatus =
      Number(targetCount) <= 1 ? PACKAGE_GROUP_STATUS.SUCCESS : PACKAGE_GROUP_STATUS.ACTIVE
    const firstClassTime =
      nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
        ? computeFirstPackageClassTime({
            successTime: now,
            weekday,
            hour
          })
        : null

    const group = await packageGroupsRepository.createPackageGroup(
      buildPackageGroupCreationPayload({
        packageId: pkg.id,
        creatorId: userId,
        targetCount,
        weekday,
        hour,
        deadline,
        currentCount: 1,
        status: nextStatus,
        firstClassTime,
        successTime: nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? now : null,
        createdAt: now
      })
    )

    const updatedOrder = await ordersRepository.updateOrder(order.id, {
      status: 'success',
      package_group_id: group.id,
      pay_time: now,
      updated_at: now
    })
    await syncOrderPaymentRecordGroupId({
      order: updatedOrder,
      packageGroupId: group.id,
      now
    })

    if (group.status === PACKAGE_GROUP_STATUS.SUCCESS) {
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
      scheduleList: group.first_class_time
        ? buildPackageLessonSchedule({
            firstClassTime: group.first_class_time,
            weeks: 5
          })
        : []
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
              weekday: lockedGroup.weekday,
              hour: lockedGroup.hour
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
      scheduleList: updatedGroup && updatedGroup.first_class_time
        ? buildPackageLessonSchedule({
            firstClassTime: updatedGroup.first_class_time,
            weeks: 5
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
