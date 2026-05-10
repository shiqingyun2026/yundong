const { env } = require('../../config/env')
const {
  coursePackagesRepository,
  groupResultNotificationJobsRepository,
  groupResultSubscriptionsRepository,
  ordersRepository,
  packageGroupsRepository
} = require('../../repositories')
const { processPendingGroupResultNotificationJobs } = require('./groupResultNotificationDelivery')
const { formatPackageDateTime } = require('./packageSchedule')

const TEMPLATE_KEY_BY_RESULT_TYPE = {
  success: 'groupSuccess',
  failed: 'groupFail'
}

const collapseLocationText = value =>
  `${value || ''}`
    .replace(/\s+/g, ' ')
    .trim()

const normalizeResultType = status => {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'failed') {
    return 'failed'
  }

  return ''
}

const buildPackageLocationText = pkg => {
  return collapseLocationText(pkg && pkg.location_community)
}

const buildGroupCourseText = ({ pkg, group }) => {
  const packageName = (pkg && pkg.name) || ''
  const targetCount = Number(group && group.target_count) || 0
  if (!packageName) {
    return targetCount > 0 ? `${targetCount}人团` : ''
  }

  return targetCount > 0 ? `${packageName}(${targetCount}人团)` : packageName
}

const loadPackageGroupWithPackage = async ({ packageGroupId }) => {
  if (!env.useMySqlRepositories) {
    throw new Error('group result notifications currently require mysql repositories')
  }

  const group = await packageGroupsRepository.findPackageGroupById(packageGroupId)
  if (!group) {
    return null
  }

  const pkg = await coursePackagesRepository.findPackageById(group.package_id)

  return {
    ...group,
    package: pkg || null
  }
}

const listSuccessfulOrderUserIds = async ({ packageGroupId }) => {
  const orders = await ordersRepository.listOrdersByPackageGroupId({
    packageGroupId,
    status: 'success'
  })

  return [...new Set(orders.map(item => item.user_id).filter(Boolean))]
}

const listSubscribedRecipients = async ({ packageGroupId, userIds, resultType }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  const templateKey = TEMPLATE_KEY_BY_RESULT_TYPE[resultType] || ''

  if (!ids.length || !templateKey) {
    return []
  }

  return groupResultSubscriptionsRepository.listSubscriptionsByGroupAndUsers({
    groupId: packageGroupId,
    userIds: ids,
    status: 'subscribed',
    templateKey
  })
}

const listExistingJobs = async ({ packageGroupId, resultType, userIds }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return []
  }

  return groupResultNotificationJobsRepository.listExistingNotificationJobs({
    groupId: packageGroupId,
    resultType,
    userIds: ids
  })
}

const buildMessageSnapshot = ({ group, resultType }) => {
  const pkg = group && group.package ? group.package : {}
  const groupCourseText = buildGroupCourseText({
    pkg,
    group
  })
  const courseAddress = buildPackageLocationText(pkg)
  const courseStartTime =
    resultType === 'success' && group && group.first_class_time
      ? formatPackageDateTime(group.first_class_time)
      : ''

  if (resultType === 'success') {
    return {
      template_key: TEMPLATE_KEY_BY_RESULT_TYPE.success,
      group_course: groupCourseText,
      course_start_time: courseStartTime,
      course_address: courseAddress,
      warm_tips: '客服稍后将联系您，请保持通话畅通'
    }
  }

  return {
    template_key: TEMPLATE_KEY_BY_RESULT_TYPE.failed,
    group_course: groupCourseText,
    failed_reason: '拼团截止前未达到成团人数',
    warm_tips: '本次拼团未成功，系统将自动原路退款，请留意微信支付到账通知'
  }
}

const deliverPendingNotificationsImmediately = async ({ supabase, limit }) => {
  try {
    return await processPendingGroupResultNotificationJobs({
      supabase,
      limit
    })
  } catch (error) {
    console.error('[group-result-notifications] immediate delivery failed', error)
    return {
      deliveryMode: '',
      total: 0,
      sent: 0,
      failed: 1,
      skipped: 0,
      jobs: [],
      error: error.message || 'immediate_delivery_failed'
    }
  }
}

const enqueueGroupResultNotifications = async ({ supabase, groupId, resultType, now = new Date() }) => {
  void supabase

  const normalizedResultType = normalizeResultType(resultType)
  if (!groupId || !normalizedResultType) {
    return {
      groupId: groupId || '',
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: 0
    }
  }

  const group = await loadPackageGroupWithPackage({
    packageGroupId: groupId
  })

  if (!group || group.status !== normalizedResultType) {
    return {
      groupId,
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: 0
    }
  }

  const userIds = await listSuccessfulOrderUserIds({
    packageGroupId: groupId
  })
  const recipients = await listSubscribedRecipients({
    packageGroupId: groupId,
    userIds,
    resultType: normalizedResultType
  })

  if (!recipients.length) {
    return {
      groupId,
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: userIds.length
    }
  }

  const existingJobs = await listExistingJobs({
    packageGroupId: groupId,
    resultType: normalizedResultType,
    userIds: recipients.map(item => item.user_id)
  })
  const existingUserIdSet = new Set(existingJobs.map(item => item.user_id).filter(Boolean))
  const timestamp = now.toISOString()
  const messageSnapshot = buildMessageSnapshot({
    group,
    resultType: normalizedResultType
  })

  const payload = recipients
    .filter(item => !existingUserIdSet.has(item.user_id))
    .map(item => ({
      user_id: item.user_id,
      group_id: group.id,
      course_id: group.package_id,
      result_type: normalizedResultType,
      template_id: item.template_id || '',
      page_path: '/pages/mine/index',
      status: 'pending',
      message_snapshot: messageSnapshot,
      subscription_requested_at: item.requested_at || timestamp,
      created_at: timestamp,
      updated_at: timestamp
    }))

  if (!payload.length) {
    return {
      groupId,
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: userIds.length
    }
  }

  const beforeExistingCount = existingJobs.length
  const jobs = await groupResultNotificationJobsRepository.createNotificationJobs(payload)
  const createdJobs = jobs.filter(item => item.group_id === groupId && item.result_type === normalizedResultType)
  const createdCount = Math.max(0, createdJobs.length - beforeExistingCount)
  const immediateDelivery =
    createdCount > 0
      ? await deliverPendingNotificationsImmediately({
          supabase,
          limit: Math.max(createdCount, Number(process.env.GROUP_RESULT_NOTIFICATION_BATCH_SIZE) || 20)
        })
      : null

  return {
    groupId,
    resultType: normalizedResultType,
    createdCount,
    skippedCount: Math.max(0, userIds.length - createdCount),
    immediateDelivery
  }
}

const enqueueNotificationsForGroups = async ({ supabase, groupIds, resultType, now = new Date() }) => {
  const ids = [...new Set((groupIds || []).filter(Boolean))]
  const results = []

  for (const groupId of ids) {
    const result = await enqueueGroupResultNotifications({
      supabase,
      groupId,
      resultType,
      now
    })
    results.push(result)
  }

  return results
}

module.exports = {
  enqueueGroupResultNotifications,
  enqueueNotificationsForGroups
}
