require('dotenv').config()

const app = require('./app')
const { syncAllCourseLifecycles } = require('./utils/courseLifecycle')

const port = Number(process.env.PORT) || 8000
const lifecycleSyncIntervalMs = Math.max(30000, Number(process.env.COURSE_LIFECYCLE_SYNC_INTERVAL_MS) || 60000)

const runCourseLifecycleSync = async () => {
  try {
    await syncAllCourseLifecycles()
  } catch (error) {
    console.error('[course-lifecycle] sync failed', error)
  }
}

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`)
  void runCourseLifecycleSync()
  setInterval(() => {
    void runCourseLifecycleSync()
  }, lifecycleSyncIntervalMs)
})
