const { env } = require('../../config/env')
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
  normalizeHour,
  normalizeWeekday
} = require('./packageSchedule')
const { parseShanghaiDate } = require('../utils/dateTime')
const { enqueueGroupResultNotifications } = require('./groupResultNotifications')
const { cleanupExpiredPackageGroups, closePendingPackageOrdersByIds, listPendingOrderIdsForPackage } = require('./packageGroupStore')
const { createPackageServiceError, isPackageServiceError } = require('./packageServiceError')

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

const isTrialPackage = pkg => !!pkg && `${pkg.package_category || ''}`.trim() === '体验课'

const validateWeekdayAndHour = ({ weekday, hour }) => {
  if (!normalizeWeekday(weekday)) {
    throw createPackageServiceError(400, 1001, 'weekday 参数错误')
  }

  if (normalizeHour(hour) < 0) {
    throw createPackageServiceError(400, 1001, 'hour 参数错误')
  }
}

const buildTrialFirstClassTime = ({ classDate, hour }) => {
  const normalizedHour = normalizeHour(hour)
  if (!classDate || normalizedHour < 0) {
    return null
  }

  return parseShanghaiDate(`${classDate} ${`${normalizedHour}`.padStart(2, '0')}:00:00`)
}

const validateTrialClassDateAndHour = ({ classDate, hour, now = new Date() }) => {
  const normalizedHour = normalizeHour(hour)
  const selectedDate = classDate ? parseShanghaiDate(`${classDate} 00:00:00`) : null

  if (!selectedDate) {
    throw createPackageServiceError(400, 1001, '请填写正确的上课日期')
  }

  if (normalizedHour < 0 || normalizedHour < 9 || normalizedHour > 19) {
    throw createPackageServiceError(400, 1001, 'hour 参数错误')
  }

  const minDate = new Date(now.getTime())
  minDate.setHours(0, 0, 0, 0)
  minDate.setDate(minDate.getDate() + 2)

  if (selectedDate.getTime() < minDate.getTime()) {
    throw createPackageServiceError(400, 1001, '上课日期不能早于开团后第2天')
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
  classDate,
  hour,
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
  const trialPackage = isTrialPackage(pkg)

  if (trialPackage) {
    validateTrialClassDateAndHour({ classDate, hour, now })
  } else {
    validateWeekdayAndHour({ weekday, hour })
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
      weekday: trialPackage ? 0 : Number(weekday),
      class_date: trialPackage ? `${classDate || ''}`.trim() : '',
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
    classDate: trialPackage ? `${classDate || ''}`.trim() : '',
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

  if (order.status === 'refunded' || order.status === 'closed') {
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

  const pkg = await getPackageByIdOrThrow(order.package_id)

  if (order.package_action === 'start') {
    const context = order.package_context || {}
    const targetCount = Number(context.target_count || context.targetCount || 0)
    const weekday = Number(context.weekday || 0)
    const classDate = `${context.class_date || context.classDate || ''}`.trim()
    const hour = Number(context.hour || 0)
    const trialPackage = isTrialPackage(pkg)

    if (trialPackage) {
      validateTrialClassDateAndHour({ classDate, hour, now })
    } else {
      validateWeekdayAndHour({ weekday, hour })
    }
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
      trialPackage
        ? buildTrialFirstClassTime({
            classDate,
            hour
          })
        : nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
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
        weekday: trialPackage ? 0 : weekday,
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
    const group = await packageGroupsRepository.findPackageGroupById(order.package_group_id)
    if (!group) {
      throw createPackageServiceError(404, 2002, '拼团不存在')
    }

    if (!isPackageGroupJoinable(group, now)) {
      throw createPackageServiceError(400, 2005, '拼团已满员或已截止')
    }

    const nextCount = Number(group.current_count) + 1
    const nextStatus = computePackageGroupNextStatus({
      currentCount: nextCount,
      targetCount: group.target_count,
      deadline: group.deadline,
      now
    })
    const firstClassTime =
      nextStatus === PACKAGE_GROUP_STATUS.SUCCESS
        ? !normalizeWeekday(group.weekday) && group.first_class_time
          ? parseShanghaiDate(group.first_class_time)
          : computeFirstPackageClassTime({
              successTime: now,
              weekday: group.weekday,
              hour: group.hour
            })
        : null

    const updatedOrder = await ordersRepository.updateOrder(order.id, {
      status: 'success',
      pay_time: now,
      updated_at: now
    })
    const updatedGroup = await packageGroupsRepository.updatePackageGroup(group.id, {
      current_count: nextCount,
      status: nextStatus,
      success_time: nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? now : group.success_time || null,
      first_class_time: nextStatus === PACKAGE_GROUP_STATUS.SUCCESS ? firstClassTime : group.first_class_time || null
    })

    if (group.status !== PACKAGE_GROUP_STATUS.SUCCESS && updatedGroup.status === PACKAGE_GROUP_STATUS.SUCCESS) {
      await enqueueGroupResultNotifications({
        supabase: null,
        groupId: updatedGroup.id,
        resultType: 'success',
        now
      })
    }

    return {
      order: updatedOrder,
      status: 'success',
      packageGroupId: updatedGroup.id,
      groupStatus: updatedGroup.status,
      firstClassTime: updatedGroup.first_class_time ? formatPackageDateTime(updatedGroup.first_class_time) : null,
      scheduleList: updatedGroup.first_class_time
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
