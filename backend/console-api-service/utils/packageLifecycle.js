const { env } = require('../config/env')
const { coursePackagesRepository } = require('../repositories')
const { parseShanghaiDate } = require('../shared/utils/dateTime')
const { writeAdminLog } = require('./adminStore')

const PACKAGE_STATUS = {
  INACTIVE: 0,
  ACTIVE: 1,
  PENDING: 2
}

const safeDate = value => {
  if (!value) {
    return null
  }

  return parseShanghaiDate(value)
}

const safeWriteAdminLog = async payload => {
  try {
    await writeAdminLog(payload)
  } catch (error) {
    console.error('[packageLifecycle] write admin log failed', error)
  }
}

const computePackageLifecycleStatus = (pkg, now = new Date()) => {
  const publishTime = safeDate(pkg.publish_time)
  const unpublishTime = safeDate(pkg.unpublish_time)

  if (unpublishTime && now.getTime() >= unpublishTime.getTime()) {
    return PACKAGE_STATUS.INACTIVE
  }

  if (publishTime && now.getTime() < publishTime.getTime()) {
    return PACKAGE_STATUS.PENDING
  }

  return PACKAGE_STATUS.ACTIVE
}

const syncPackageLifecycle = async (packageIds = [], options = {}) => {
  if (!env.useMySqlRepositories) {
    return {}
  }

  const uniquePackageIds = [...new Set((packageIds || []).filter(Boolean))]
  if (!uniquePackageIds.length) {
    return {}
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const packages = await coursePackagesRepository.findPackagesByIds(uniquePackageIds)
  const result = {}

  for (const pkg of packages || []) {
    const nextStatus = computePackageLifecycleStatus(pkg, now)

    if (Number(pkg.status) !== nextStatus) {
      await coursePackagesRepository.updatePackageStatus(pkg.id, nextStatus, now)

      if (options.operatorId) {
        await safeWriteAdminLog({
          adminId: options.operatorId,
          action: 'package_status_sync',
          targetType: 'course_package',
          targetId: pkg.id,
          detail: {
            previous_status: Number(pkg.status),
            next_status: nextStatus
          },
          ip: null
        })
      }
    }

    result[pkg.id] = {
      status: nextStatus
    }
  }

  return result
}

const syncAllPackageLifecycles = async (options = {}) => {
  if (!env.useMySqlRepositories) {
    return {}
  }

  const packages = await coursePackagesRepository.listPackages()
  return syncPackageLifecycle(
    packages.map(item => item.id),
    options
  )
}

module.exports = {
  PACKAGE_STATUS,
  computePackageLifecycleStatus,
  safeDate,
  syncAllPackageLifecycles,
  syncPackageLifecycle
}
