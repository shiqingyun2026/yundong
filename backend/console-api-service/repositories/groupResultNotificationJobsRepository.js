const { execute, query } = require('../config/db')
const { buildInClause, createUuid, parseJsonField, stringifyJsonField, toDbDateTime } = require('./_helpers')

const JOB_SELECT_FIELDS = `
  id,
  user_id,
  group_id,
  course_id,
  result_type,
  template_id,
  page_path,
  status,
  message_snapshot,
  subscription_requested_at,
  sent_at,
  failure_reason,
  created_at,
  updated_at
`

const normalizeNotificationJob = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    user_id: row.user_id,
    group_id: row.group_id,
    course_id: row.course_id,
    result_type: row.result_type || '',
    template_id: row.template_id || '',
    page_path: row.page_path || '',
    status: row.status || 'pending',
    message_snapshot: parseJsonField(row.message_snapshot) || {},
    subscription_requested_at: row.subscription_requested_at || null,
    sent_at: row.sent_at || null,
    failure_reason: row.failure_reason || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const createNotificationJobs = async jobs => {
  const payload = (jobs || []).filter(Boolean)
  if (!payload.length) {
    return []
  }

  for (const item of payload) {
    await execute(
      `
        insert into group_result_notification_jobs (
          id, user_id, group_id, course_id, result_type, template_id, page_path,
          status, message_snapshot, subscription_requested_at, sent_at, failure_reason, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on duplicate key update
          template_id = values(template_id),
          page_path = values(page_path),
          status = values(status),
          message_snapshot = values(message_snapshot),
          subscription_requested_at = values(subscription_requested_at),
          sent_at = values(sent_at),
          failure_reason = values(failure_reason),
          updated_at = values(updated_at)
      `,
      [
        item.id || createUuid(),
        item.user_id,
        item.group_id,
        item.course_id,
        item.result_type,
        item.template_id || '',
        item.page_path || '',
        item.status || 'pending',
        stringifyJsonField(item.message_snapshot || {}),
        item.subscription_requested_at ? toDbDateTime(item.subscription_requested_at) : null,
        item.sent_at ? toDbDateTime(item.sent_at) : null,
        item.failure_reason || '',
        toDbDateTime(item.created_at || new Date()),
        toDbDateTime(item.updated_at || new Date())
      ]
    )
  }

  const { items, placeholders } = buildInClause(payload.map(item => item.group_id))
  const rows = await query(
    `
      select ${JOB_SELECT_FIELDS}
      from group_result_notification_jobs
      where group_id in (${placeholders})
    `,
    items
  )

  return rows.map(normalizeNotificationJob)
}

const listExistingNotificationJobs = async ({ groupId, resultType, userIds = [] } = {}) => {
  const { items, placeholders } = buildInClause(userIds)
  if (!groupId || !resultType || !items.length) {
    return []
  }

  const rows = await query(
    `
      select ${JOB_SELECT_FIELDS}
      from group_result_notification_jobs
      where group_id = ?
        and result_type = ?
        and user_id in (${placeholders})
    `,
    [groupId, resultType, ...items]
  )

  return rows.map(normalizeNotificationJob)
}

const listPendingNotificationJobs = async ({ limit = 20 } = {}) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
  const rows = await query(
    `
      select ${JOB_SELECT_FIELDS}
      from group_result_notification_jobs
      where status = 'pending'
      order by created_at asc
      limit ?
    `,
    [safeLimit]
  )

  return rows.map(normalizeNotificationJob)
}

const updateNotificationJobStatus = async ({ jobId, status, sentAt = null, failureReason = '' }) => {
  await execute(
    `
      update group_result_notification_jobs
      set status = ?,
          sent_at = ?,
          failure_reason = ?,
          updated_at = ?
      where id = ?
    `,
    [status, sentAt ? toDbDateTime(sentAt) : null, failureReason || '', toDbDateTime(new Date()), jobId]
  )

  const rows = await query(
    `
      select ${JOB_SELECT_FIELDS}
      from group_result_notification_jobs
      where id = ?
      limit 1
    `,
    [jobId]
  )

  return normalizeNotificationJob(rows[0])
}

module.exports = {
  createNotificationJobs,
  listExistingNotificationJobs,
  listPendingNotificationJobs,
  updateNotificationJobStatus
}
