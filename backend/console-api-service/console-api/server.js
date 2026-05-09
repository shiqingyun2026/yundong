require('dotenv').config()

const app = require('./app')
const { syncAllCourseLifecycles } = require('../utils/courseLifecycle')
const { syncAllPackageLifecycles } = require('../utils/packageLifecycle')
const { syncPendingPackageRefundStatuses } = require('../utils/packageRefundStatusSync')

const port = Number(process.env.CONSOLE_API_PORT || process.env.PORT) || 8100
const lifecycleSyncIntervalMs = Math.max(30000, Number(process.env.COURSE_LIFECYCLE_SYNC_INTERVAL_MS) || 60000)
const refundStatusSyncIntervalMs = Math.max(60000, Number(process.env.PACKAGE_REFUND_STATUS_SYNC_INTERVAL_MS) || 60000)
const enableLifecycleSync = `${process.env.CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC || ''}` === 'true'
const enableRefundStatusSync = `${process.env.CONSOLE_API_ENABLE_PACKAGE_REFUND_STATUS_SYNC || ''}` !== 'false'

const runCourseLifecycleSync = async () => {
  try {
    await syncAllCourseLifecycles()
  } catch (error) {
    console.error('[console-api][course-lifecycle] sync failed', error)
  }
}

const runPackageLifecycleSync = async () => {
  try {
    await syncAllPackageLifecycles()
  } catch (error) {
    console.error('[console-api][package-lifecycle] sync failed', error)
  }
}

const runPackageRefundStatusSync = async () => {
  try {
    await syncPendingPackageRefundStatuses()
  } catch (error) {
    console.error('[console-api][package-refund-status] sync failed', error)
  }
}

app.listen(port, () => {
  console.log(`Console API server listening on port ${port}`)

  if (enableRefundStatusSync) {
    void runPackageRefundStatusSync()
    setInterval(() => {
      void runPackageRefundStatusSync()
    }, refundStatusSyncIntervalMs)
  }

  if (!enableLifecycleSync) {
    return
  }
  void runCourseLifecycleSync()
  void runPackageLifecycleSync()
  setInterval(() => {
    void runCourseLifecycleSync()
  }, lifecycleSyncIntervalMs)
  setInterval(() => {
    void runPackageLifecycleSync()
  }, lifecycleSyncIntervalMs)
})
