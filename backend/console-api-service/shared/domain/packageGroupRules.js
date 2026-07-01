const { createPackageServiceError } = require('../services/packageServiceError')

const PACKAGE_GROUP_STATUS = {
  ACTIVE: 'active',
  SUCCESS: 'success',
  FAILED: 'failed'
}

const normalizeGroupPriceConfig = value => {
  const items = Array.isArray(value) ? value : []

  return items
    .map(item => {
      const targetCount = Number(item && item.target_count) || 0
      const minSuccessCount = Number(item && item.min_success_count) || targetCount

      return {
        min_success_count: minSuccessCount,
        target_count: targetCount,
        price_fen: Number(item && item.price_fen) || 0
      }
    })
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

const findMinSuccessCount = ({ groupPriceConfig = [], targetCount }) => {
  const normalizedTargetCount = Number(targetCount) || 0
  if (normalizedTargetCount <= 0) {
    return 0
  }

  const matched = normalizeGroupPriceConfig(groupPriceConfig).find(item => item.target_count === normalizedTargetCount)
  return matched ? matched.min_success_count : normalizedTargetCount
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

const resolvePackageDeadlineHours = pkg => {
  const normalizedHours = Number(pkg && pkg.deadline_hours)
  return normalizedHours > 0 ? normalizedHours : 48
}

const resolvePackageDeadlineMinutesOverride = () => {
  const explicitMinutes = Number(process.env.PACKAGE_GROUP_DEADLINE_MINUTES)
  if (explicitMinutes > 0) {
    return explicitMinutes
  }

  const serviceNames = [
    process.env.CLOUDBASE_SERVICE_NAME,
    process.env.TCB_SERVICE_NAME,
    process.env.K_SERVICE,
    process.env.WX_CLOUD_RUN_SERVICE_NAME,
    process.env.LINDONG_API_SERVICE_NAME
  ].map(value => `${value || ''}`.trim())

  return serviceNames.includes('lindong-api-test') ? 5 : 0
}

const buildPackageDeadline = ({ createdAt, deadlineHours = 48, deadlineMinutes = 0 }) => {
  const date = createdAt instanceof Date ? new Date(createdAt.getTime()) : new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const minutesOverride = Number(deadlineMinutes) || resolvePackageDeadlineMinutesOverride()
  if (minutesOverride > 0) {
    date.setMinutes(date.getMinutes() + minutesOverride)
    return date
  }

  date.setHours(date.getHours() + (Number(deadlineHours) || 48))
  return date
}

const buildPackageDeadlineFromPackage = ({ createdAt, pkg }) =>
  buildPackageDeadline({
    createdAt,
    deadlineHours: resolvePackageDeadlineHours(pkg)
  })

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

const computePackageGroupDeadlineStatus = ({
  currentCount,
  targetCount,
  minSuccessCount,
  deadline,
  now = new Date()
}) => {
  const normalizedCurrentCount = Number(currentCount) || 0
  const normalizedTargetCount = Number(targetCount) || 0
  const normalizedMinSuccessCount = Number(minSuccessCount) || normalizedTargetCount
  const deadlineTime = deadline instanceof Date ? deadline : new Date(deadline)

  if (normalizedTargetCount > 0 && normalizedCurrentCount >= normalizedTargetCount) {
    return PACKAGE_GROUP_STATUS.SUCCESS
  }

  if (Number.isNaN(deadlineTime.getTime()) || deadlineTime.getTime() > now.getTime()) {
    return PACKAGE_GROUP_STATUS.ACTIVE
  }

  if (normalizedMinSuccessCount > 0 && normalizedCurrentCount >= normalizedMinSuccessCount) {
    return PACKAGE_GROUP_STATUS.SUCCESS
  }

  return PACKAGE_GROUP_STATUS.FAILED
}

const buildPackageGroupCreationPayload = ({
  packageId,
  locationId = null,
  locationSnapshot = null,
  creatorId,
  targetCount,
  minSuccessCount,
  weekday,
  hour,
  scheduleConfig = null,
  deadline,
  currentCount = 1,
  status = PACKAGE_GROUP_STATUS.ACTIVE,
  firstClassTime = null,
  successTime = null,
  createdAt = new Date()
}) => ({
  package_id: packageId,
  location_id: locationId || null,
  location_snapshot: locationSnapshot || null,
  creator_id: creatorId,
  target_count: Number(targetCount) || 0,
  min_success_count: Number(minSuccessCount) || Number(targetCount) || 0,
  current_count: Number(currentCount) || 0,
  status,
  weekday: Number(weekday) || 0,
  hour: Number(hour) || 0,
  schedule_config: scheduleConfig,
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
  buildPackageDeadlineFromPackage,
  buildPackageGroupCreationPayload,
  calculatePackageMemberAmountFen,
  calculatePackagePlatformSubsidyFen,
  computePackageGroupDeadlineStatus,
  computePackageGroupNextStatus,
  findMinSuccessCount,
  findGroupPriceFen,
  isPackageGroupJoinable,
  normalizeGroupPriceConfig,
  resolvePackageDeadlineMinutesOverride,
  resolvePackageDeadlineHours
}
