const { syncAllCourseLifecycles } = require('./courseLifecycle')
const { syncAllPackageLifecycles } = require('./packageLifecycle')

const resolveLifecycleSyncIntervalMs = value =>
  Math.max(30000, Number(value || process.env.COURSE_LIFECYCLE_SYNC_INTERVAL_MS) || 60000)

const startLifecycleScheduler = ({
  intervalMs = resolveLifecycleSyncIntervalMs(),
  syncAllCourseLifecycles: syncCourses = syncAllCourseLifecycles,
  syncAllPackageLifecycles: syncPackages = syncAllPackageLifecycles,
  setIntervalFn = setInterval,
  logger = console
} = {}) => {
  const resolvedIntervalMs = resolveLifecycleSyncIntervalMs(intervalMs)
  const running = {
    course: false,
    package: false
  }

  const runLifecycleSync = (key, label, syncFn) => {
    if (running[key]) {
      return
    }

    running[key] = true

    Promise.resolve()
      .then(() => syncFn())
      .catch(error => {
        logger.error(`[${label}] sync failed`, error)
      })
      .finally(() => {
        running[key] = false
      })
  }

  const runCourseLifecycleSync = () => runLifecycleSync('course', 'course-lifecycle', syncCourses)
  const runPackageLifecycleSync = () => runLifecycleSync('package', 'package-lifecycle', syncPackages)

  runCourseLifecycleSync()
  runPackageLifecycleSync()

  const courseInterval = setIntervalFn(runCourseLifecycleSync, resolvedIntervalMs)
  const packageInterval = setIntervalFn(runPackageLifecycleSync, resolvedIntervalMs)

  return {
    courseInterval,
    packageInterval,
    intervalMs: resolvedIntervalMs
  }
}

module.exports = {
  resolveLifecycleSyncIntervalMs,
  startLifecycleScheduler
}
