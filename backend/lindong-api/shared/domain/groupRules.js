const { safeDate } = require('../../utils/courseLifecycle')

const normalizeGroupStatus = status => {
  if (status === 'active') {
    return 'ongoing'
  }

  if (status === 'success') {
    return 'success'
  }

  return 'failed'
}

const hasSuccessfulParticipation = ({ successMembershipExists = false, successOrderExists = false }) => {
  return !!successMembershipExists || !!successOrderExists
}

const isGroupJoinable = (group, now = new Date()) => {
  if (!group) {
    return false
  }

  const expireAt = safeDate(group.expire_time)
  return group.status === 'active' && !!expireAt && expireAt.getTime() > now.getTime()
}

const canApplyPaymentToGroup = ({ group, membershipExists, now = new Date() }) => {
  if (membershipExists) {
    return true
  }

  return isGroupJoinable(group, now)
}

const buildGroupCreationPayload = ({ courseId, creatorId, deadline, targetCount }) => ({
  course_id: courseId,
  creator_id: creatorId,
  status: 'active',
  current_count: 0,
  target_count: Number(targetCount) || 0,
  expire_time: deadline
})

const computeNextGroupStatus = (group, now = new Date()) => {
  const targetCount = Number((group && group.target_count) || 0)
  const currentCount = Number((group && group.current_count) || 0)
  const expireAt = safeDate(group && group.expire_time)

  if (targetCount > 0 && currentCount >= targetCount) {
    return 'success'
  }

  if (expireAt && expireAt.getTime() <= now.getTime()) {
    return 'failed'
  }

  return 'active'
}

const applyPaymentToGroup = ({ group, membershipExists, now = new Date() }) => {
  const currentCount = Number((group && group.current_count) || 0)
  const nextCount = membershipExists ? currentCount : currentCount + 1
  const nextStatus = computeNextGroupStatus(
    {
      ...group,
      current_count: nextCount
    },
    now
  )

  return {
    nextCount,
    nextStatus,
    membershipShouldCreate: !membershipExists,
    shouldUpdateGroup: nextCount !== currentCount || nextStatus !== (group && group.status)
  }
}

const applyRefundToGroup = ({ group, membershipExists, now = new Date() }) => {
  const currentCount = Number((group && group.current_count) || 0)
  const nextCount = membershipExists ? Math.max(0, currentCount - 1) : currentCount
  const nextStatus = computeNextGroupStatus(
    {
      ...group,
      current_count: nextCount
    },
    now
  )

  return {
    nextCount,
    nextStatus,
    membershipShouldDelete: !!membershipExists
  }
}

module.exports = {
  applyPaymentToGroup,
  applyRefundToGroup,
  buildGroupCreationPayload,
  canApplyPaymentToGroup,
  computeNextGroupStatus,
  hasSuccessfulParticipation,
  isGroupJoinable,
  normalizeGroupStatus
}
