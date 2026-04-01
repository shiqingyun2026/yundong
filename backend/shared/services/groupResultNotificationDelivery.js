const DEFAULT_BATCH_SIZE = 20
const { sendGroupResultSubscribeMessage } = require('./wechatMiniProgramNotifications')

const resolveDeliveryMode = inputMode => {
  const mode = `${inputMode || process.env.GROUP_RESULT_NOTIFICATION_DELIVERY_MODE || 'mock'}`.trim().toLowerCase()

  if (mode === 'off') {
    return 'off'
  }

  if (mode === 'wechat') {
    return 'wechat'
  }

  return 'mock'
}

const listPendingJobs = async ({ supabase, limit = DEFAULT_BATCH_SIZE }) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || DEFAULT_BATCH_SIZE))
  const { data, error } = await supabase
    .from('group_result_notification_jobs')
    .select(
      'id, user_id, group_id, course_id, result_type, template_id, page_path, status, message_snapshot, subscription_requested_at, sent_at, failure_reason, created_at, updated_at'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(safeLimit)

  if (error) {
    throw error
  }

  return data || []
}

const fetchUsersByIds = async ({ supabase, userIds }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return {}
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, openid')
    .in('id', ids)

  if (error) {
    throw error
  }

  return (data || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})
}

const updateJobStatus = async ({ supabase, jobId, status, sentAt, failureReason = '' }) => {
  const payload = {
    status,
    updated_at: new Date().toISOString(),
    failure_reason: failureReason
  }

  if (sentAt) {
    payload.sent_at = sentAt
  }

  const { error } = await supabase
    .from('group_result_notification_jobs')
    .update(payload)
    .eq('id', jobId)

  if (error) {
    throw error
  }
}

const validateJob = job => {
  if (!job) {
    return 'job_not_found'
  }

  if (!job.template_id) {
    return 'template_id_missing'
  }

  if (!job.page_path) {
    return 'page_path_missing'
  }

  if (!job.message_snapshot || !job.message_snapshot.title || !job.message_snapshot.result_text) {
    return 'message_snapshot_incomplete'
  }

  return ''
}

const deliverJob = async ({ job, deliveryMode }) => {
  const validationError = validateJob(job)
  if (validationError) {
    return {
      finalStatus: 'skipped',
      sentAt: '',
      failureReason: validationError
    }
  }

  if (deliveryMode === 'off') {
    return {
      finalStatus: 'skipped',
      sentAt: '',
      failureReason: 'delivery_mode_off'
    }
  }

  if (deliveryMode === 'wechat') {
    return {
      finalStatus: 'failed',
      sentAt: '',
      failureReason: 'wechat_delivery_not_implemented'
    }
  }

  return {
    finalStatus: 'sent',
    sentAt: new Date().toISOString(),
    failureReason: ''
  }
}

const processPendingGroupResultNotificationJobs = async ({
  supabase,
  limit = DEFAULT_BATCH_SIZE,
  mode
}) => {
  const deliveryMode = resolveDeliveryMode(mode)
  const jobs = await listPendingJobs({
    supabase,
    limit
  })
  const usersById = await fetchUsersByIds({
    supabase,
    userIds: jobs.map(item => item.user_id)
  })

  const result = {
    deliveryMode,
    total: jobs.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    jobs: []
  }

  for (const job of jobs) {
    let deliveryResult = null

    if (deliveryMode === 'wechat') {
      const user = usersById[job.user_id] || null

      try {
        await sendGroupResultSubscribeMessage({
          openId: user && user.openid ? user.openid : '',
          job
        })

        deliveryResult = {
          finalStatus: 'sent',
          sentAt: new Date().toISOString(),
          failureReason: ''
        }
      } catch (error) {
        deliveryResult = {
          finalStatus: 'failed',
          sentAt: '',
          failureReason: error.message || 'wechat_delivery_failed'
        }
      }
    } else {
      deliveryResult = await deliverJob({
        job,
        deliveryMode
      })
    }

    await updateJobStatus({
      supabase,
      jobId: job.id,
      status: deliveryResult.finalStatus,
      sentAt: deliveryResult.sentAt,
      failureReason: deliveryResult.failureReason
    })

    if (deliveryResult.finalStatus === 'sent') {
      result.sent += 1
    } else if (deliveryResult.finalStatus === 'failed') {
      result.failed += 1
    } else {
      result.skipped += 1
    }

    result.jobs.push({
      id: job.id,
      status: deliveryResult.finalStatus,
      reason: deliveryResult.failureReason
    })
  }

  return result
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  processPendingGroupResultNotificationJobs,
  resolveDeliveryMode
}
