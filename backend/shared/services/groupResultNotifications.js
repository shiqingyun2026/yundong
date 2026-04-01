const loadGroupWithCourse = async ({ supabase, groupId }) => {
  const { data: group, error } = await supabase
    .from('groups')
    .select(
      'id, course_id, status, current_count, target_count, expire_time, courses!inner(id, name, address, start_time)'
    )
    .eq('id', groupId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!group) {
    return null
  }

  const course = Array.isArray(group.courses) ? group.courses[0] : group.courses

  return {
    ...group,
    course: course || null
  }
}

const listSuccessfulOrderUserIds = async ({ supabase, groupId }) => {
  const { data, error } = await supabase
    .from('orders')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'success')

  if (error) {
    throw error
  }

  return [...new Set((data || []).map(item => item.user_id).filter(Boolean))]
}

const listSubscribedRecipients = async ({ supabase, groupId, userIds }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return []
  }

  const { data, error } = await supabase
    .from('group_result_subscriptions')
    .select('user_id, template_id, requested_at')
    .eq('group_id', groupId)
    .eq('status', 'subscribed')
    .in('user_id', ids)

  if (error) {
    throw error
  }

  return data || []
}

const listExistingJobs = async ({ supabase, groupId, resultType, userIds }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) {
    return []
  }

  const { data, error } = await supabase
    .from('group_result_notification_jobs')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('result_type', resultType)
    .in('user_id', ids)

  if (error) {
    throw error
  }

  return data || []
}

const normalizeResultType = status => {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'failed') {
    return 'failed'
  }

  return ''
}

const buildMessageSnapshot = ({ group, resultType }) => {
  const course = group && group.course ? group.course : {}
  const courseName = course.name || ''
  const courseAddress = course.address || ''
  const courseStartTime = course.start_time || ''

  if (resultType === 'success') {
    return {
      title: '拼团成功通知',
      result_text: `你参与的“${courseName}”已拼团成功`,
      action_text: '请按时到场',
      course_name: courseName,
      course_address: courseAddress,
      course_start_time: courseStartTime
    }
  }

  return {
    title: '拼团失败通知',
    result_text: `你参与的“${courseName}”未拼团成功`,
    action_text: '系统将原路退款',
    course_name: courseName,
    course_address: courseAddress,
    course_start_time: courseStartTime
  }
}

const enqueueGroupResultNotifications = async ({ supabase, groupId, resultType, now = new Date() }) => {
  const normalizedResultType = normalizeResultType(resultType)
  if (!groupId || !normalizedResultType) {
    return {
      groupId: groupId || '',
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: 0
    }
  }

  const group = await loadGroupWithCourse({
    supabase,
    groupId
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
    supabase,
    groupId
  })
  const recipients = await listSubscribedRecipients({
    supabase,
    groupId,
    userIds
  })

  if (!recipients.length) {
    return {
      groupId,
      resultType: normalizedResultType,
      createdCount: 0,
      skippedCount: userIds.length
    }
  }

  const timestamp = now.toISOString()
  const messageSnapshot = buildMessageSnapshot({
    group,
    resultType: normalizedResultType
  })
  const existingJobs = await listExistingJobs({
    supabase,
    groupId,
    resultType: normalizedResultType,
    userIds: recipients.map(item => item.user_id)
  })
  const existingUserIdSet = new Set(existingJobs.map(item => item.user_id).filter(Boolean))
  const payload = recipients
    .filter(item => !existingUserIdSet.has(item.user_id))
    .map(item => ({
      user_id: item.user_id,
      group_id: group.id,
      course_id: group.course_id,
      result_type: normalizedResultType,
      template_id: item.template_id || '',
    page_path: `/pages/group/detail/index?courseId=${group.course_id}&groupId=${group.id}`,
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

  const { data, error } = await supabase
    .from('group_result_notification_jobs')
    .insert(payload)
    .select('id')

  if (error) {
    throw error
  }

  return {
    groupId,
    resultType: normalizedResultType,
    createdCount: (data || []).length,
    skippedCount: Math.max(0, userIds.length - (data || []).length)
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
