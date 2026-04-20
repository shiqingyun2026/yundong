const { execute, query } = require('../config/db')
const { createUuid, parseJsonField, stringifyJsonField, toDbDateTime, buildInClause } = require('./_helpers')

const SUBSCRIPTION_SELECT_FIELDS = `
  id,
  user_id,
  group_id,
  course_id,
  scene,
  template_key,
  template_id,
  decision,
  status,
  reason,
  raw_result,
  requested_at,
  created_at,
  updated_at
`

const normalizeSubscription = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    user_id: row.user_id,
    group_id: row.group_id,
    course_id: row.course_id,
    scene: row.scene || 'group_result',
    template_key: row.template_key || 'groupResult',
    template_id: row.template_id || '',
    decision: row.decision || 'unknown',
    status: row.status || 'unsubscribed',
    reason: row.reason || '',
    raw_result: parseJsonField(row.raw_result),
    requested_at: row.requested_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }
}

const listSubscriptionsByGroupAndUsers = async ({ groupId, userIds = [], status } = {}) => {
  const { items, placeholders } = buildInClause(userIds)
  if (!groupId || !items.length) {
    return []
  }

  const conditions = ['group_id = ?', `user_id in (${placeholders})`]
  const params = [groupId, ...items]

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const rows = await query(
    `
      select ${SUBSCRIPTION_SELECT_FIELDS}
      from group_result_subscriptions
      where ${conditions.join(' and ')}
    `,
    params
  )

  return rows.map(normalizeSubscription)
}

const listSubscriptionsByGroupId = async groupId => {
  const rows = await query(
    `
      select ${SUBSCRIPTION_SELECT_FIELDS}
      from group_result_subscriptions
      where group_id = ?
    `,
    [groupId]
  )

  return rows.map(normalizeSubscription)
}

const upsertSubscription = async ({
  id = createUuid(),
  user_id,
  group_id,
  course_id,
  scene = 'group_result',
  template_key = 'groupResult',
  template_id = '',
  decision = 'unknown',
  status = 'unsubscribed',
  reason = '',
  raw_result = null,
  requested_at = new Date(),
  created_at = requested_at,
  updated_at = requested_at
}) => {
  await execute(
    `
      insert into group_result_subscriptions (
        id, user_id, group_id, course_id, scene, template_key, template_id,
        decision, status, reason, raw_result, requested_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        course_id = values(course_id),
        scene = values(scene),
        template_id = values(template_id),
        decision = values(decision),
        status = values(status),
        reason = values(reason),
        raw_result = values(raw_result),
        requested_at = values(requested_at),
        updated_at = values(updated_at)
    `,
    [
      id,
      user_id,
      group_id,
      course_id,
      scene,
      template_key,
      template_id,
      decision,
      status,
      reason,
      stringifyJsonField(raw_result),
      toDbDateTime(requested_at),
      toDbDateTime(created_at),
      toDbDateTime(updated_at)
    ]
  )

  const rows = await query(
    `
      select ${SUBSCRIPTION_SELECT_FIELDS}
      from group_result_subscriptions
      where user_id = ?
        and group_id = ?
        and template_key = ?
      limit 1
    `,
    [user_id, group_id, template_key]
  )

  return normalizeSubscription(rows[0])
}

module.exports = {
  listSubscriptionsByGroupAndUsers,
  listSubscriptionsByGroupId,
  upsertSubscription
}
