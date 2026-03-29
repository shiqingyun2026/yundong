require('dotenv').config()

const app = require('./app')
const { syncAllCourseLifecycles } = require('../utils/courseLifecycle')

const port = Number(process.env.CONSOLE_API_PORT || process.env.PORT) || 8100
const lifecycleSyncIntervalMs = Math.max(30000, Number(process.env.COURSE_LIFECYCLE_SYNC_INTERVAL_MS) || 60000)
const enableLifecycleSync = `${process.env.CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC || ''}` === 'true'

const runCourseLifecycleSync = async () => {
  try {
    await syncAllCourseLifecycles()
  } catch (error) {
    console.error('[console-api][course-lifecycle] sync failed', error)
  }
}

app.listen(port, () => {
  console.log(`Console API server listening on port ${port}`)

  if (!enableLifecycleSync) {
    return
  }

  void runCourseLifecycleSync()
  setInterval(() => {
    void runCourseLifecycleSync()
  }, lifecycleSyncIntervalMs)
})
