const { createPackageServiceError } = require('../services/packageServiceError')

const PACKAGE_GROUP_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELED: 'canceled'
}

const normalizeGroupPriceConfig = value => {
  const items = Array.isArray(value) ? value : []

  return items
    .map(item => ({
      target_count: Number(item && item.target_count) || 0,
      price_fen: Number(item && item.price_fen) || 0
    }))
    .filter(item => item.target_count > 0 && item.price_fen > 0)
    .sort((left, right) => left.target_count - right.target_count)
}

const findGroupPriceFen = ({ groupPriceConfig = [], targetCount }) => {
  const normalizedTargetCount = Number(targetCount) || 0
  if (normalizedTargetCount <= 0) {
    return 0
  }

  const matched = normalizeGroupPriceConfig(groupPriceConfig).find(item => item.target_count === normalizedTargetCount)
  return matched ? matched.price_fen : 0
}

const calculatePackageMemberAmountFen = ({ totalPrice, targetCount, groupPriceConfig = [] }) => {
  const matchedPriceFen = findGroupPriceFen({
    groupPriceConfig,
    targetCount
  })

  if (matchedPriceFen > 0) {
    return matchedPriceFen
  }

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

const buildPackageDeadline = ({ createdAt, deadlineHours = 48, deadlineMinutes = null }) => {
  const date = createdAt instanceof Date ? new Date(createdAt.getTime()) : new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  if (deadlineMinutes !== null && deadlineMinutes !== undefined) {
    date.setMinutes(date.getMinutes() + (Number(deadlineMinutes) || 0))
    return date
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

const computePackageGroupStatusAfterRefund = ({
  group,
  currentCount,
  emptyGroupStatus = PACKAGE_GROUP_STATUS.CANCELED,
  now = new Date()
}) => {
  const normalizedCurrentCount = Math.max(0, Number(currentCount) || 0)
  if (normalizedCurrentCount <= 0) {
    return emptyGroupStatus
  }

  return computePackageGroupNextStatus({
    currentCount: normalizedCurrentCount,
    targetCount: group && group.target_count,
    deadline: group && group.deadline,
    now
  })
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
  computePackageGroupStatusAfterRefund,
  computePackageGroupNextStatus,
  findGroupPriceFen,
  isPackageGroupJoinable
}
