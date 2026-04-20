const { createPackageServiceError } = require('../services/packageServiceError')

const PACKAGE_GROUP_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  FAILED: 'failed'
}

const calculatePackageMemberAmountFen = ({ totalPrice, targetCount }) => {
  const normalizedTotalPrice = Number(totalPrice) || 0
  const normalizedTargetCount = Number(targetCount) || 0

  if (normalizedTotalPrice < 0 || normalizedTargetCount <= 0) {
    return 0
  }

  return Math.floor(normalizedTotalPrice / normalizedTargetCount)
}

const calculatePackagePlatformSubsidyFen = ({ totalPrice, targetCount }) => {
  const normalizedTotalPrice = Number(totalPrice) || 0
  const normalizedTargetCount = Number(targetCount) || 0
  const memberAmountFen = calculatePackageMemberAmountFen({
    totalPrice: normalizedTotalPrice,
    targetCount: normalizedTargetCount
  })

  return Math.max(0, normalizedTotalPrice - memberAmountFen * normalizedTargetCount)
}

const buildPackageDeadline = ({ createdAt, deadlineHours = 48 }) => {
  const date = createdAt instanceof Date ? new Date(createdAt.getTime()) : new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  date.setHours(date.getHours() + (Number(deadlineHours) || 48))
  return date
}

const isPackageGroupJoinable = (group, now = new Date()) => {
  if (!group) {
    return false
  }

  const deadline = group.deadline instanceof Date ? group.deadline : new Date(group.deadline)
  if (Number.isNaN(deadline.getTime())) {
    return false
  }

  return (
    group.status === PACKAGE_GROUP_STATUS.ACTIVE &&
    deadline.getTime() > now.getTime() &&
    Number(group.current_count) < Number(group.target_count)
  )
}

const computePackageGroupNextStatus = ({ currentCount, targetCount, deadline, now = new Date() }) => {
  const normalizedCurrentCount = Number(currentCount) || 0
  const normalizedTargetCount = Number(targetCount) || 0
  const deadlineTime = deadline instanceof Date ? deadline : new Date(deadline)

  if (normalizedTargetCount > 0 && normalizedCurrentCount >= normalizedTargetCount) {
    return PACKAGE_GROUP_STATUS.SUCCESS
  }

  if (!Number.isNaN(deadlineTime.getTime()) && deadlineTime.getTime() <= now.getTime()) {
    return PACKAGE_GROUP_STATUS.FAILED
  }

  return PACKAGE_GROUP_STATUS.ACTIVE
}

const buildPackageGroupCreationPayload = ({
  packageId,
  creatorId,
  targetCount,
  weekday,
  hour,
  deadline,
  currentCount = 1,
  status = PACKAGE_GROUP_STATUS.ACTIVE,
  firstClassTime = null,
  successTime = null,
  createdAt = new Date()
}) => ({
  package_id: packageId,
  creator_id: creatorId,
  target_count: Number(targetCount) || 0,
  current_count: Number(currentCount) || 0,
  status,
  weekday: Number(weekday) || 0,
  hour: Number(hour) || 0,
  first_class_time: firstClassTime,
  deadline,
  created_at: createdAt,
  success_time: successTime
})

const assertSupportedTargetCount = ({ supportedPeople = [], targetCount }) => {
  if (!(supportedPeople || []).includes(Number(targetCount))) {
    throw createPackageServiceError(400, 1001, 'targetCount 不在课包支持范围内')
  }
}

module.exports = {
  PACKAGE_GROUP_STATUS,
  assertSupportedTargetCount,
  buildPackageDeadline,
  buildPackageGroupCreationPayload,
  calculatePackageMemberAmountFen,
  calculatePackagePlatformSubsidyFen,
  computePackageGroupNextStatus,
  isPackageGroupJoinable
}
