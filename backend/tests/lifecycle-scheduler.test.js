const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'lindong-api')
const flushScheduler = () => new Promise(resolve => setImmediate(resolve))

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    const modulePath = require.resolve(path.join(backendRoot, relativePath))
    delete require.cache[modulePath]
  })
}

test('lifecycle scheduler runs course and package sync immediately and on interval', async () => {
  clearModules(['utils/lifecycleScheduler.js'])

  const calls = []
  const intervals = []
  const { startLifecycleScheduler } = require(path.join(backendRoot, 'utils/lifecycleScheduler.js'))

  startLifecycleScheduler({
    intervalMs: 60000,
    syncAllCourseLifecycles: () => calls.push('course'),
    syncAllPackageLifecycles: () => calls.push('package'),
    setIntervalFn: (callback, intervalMs) => {
      intervals.push({ callback, intervalMs })
      return { intervalMs }
    },
    logger: {
      error: () => {}
    }
  })

  await flushScheduler()

  assert.deepEqual(calls, ['course', 'package'])
  assert.equal(intervals.length, 2)
  assert.deepEqual(intervals.map(item => item.intervalMs), [60000, 60000])

  intervals[0].callback()
  intervals[1].callback()

  await flushScheduler()

  assert.deepEqual(calls, ['course', 'package', 'course', 'package'])
})

test('miniprogram container server starts shared lifecycle scheduler', () => {
  clearModules([
    'miniprogram-container/server.js',
    'miniprogram-container/app.js',
    'utils/lifecycleScheduler.js'
  ])

  const schedulerCalls = []

  mockModule('miniprogram-container/app.js', {
    listen: (port, callback) => {
      callback()
      return { port }
    }
  })

  mockModule('utils/lifecycleScheduler.js', {
    startLifecycleScheduler: payload => {
      schedulerCalls.push(payload)
    }
  })

  const originalLog = console.log
  console.log = () => {}
  try {
    require(path.join(backendRoot, 'miniprogram-container/server.js'))
  } finally {
    console.log = originalLog
  }

  assert.equal(schedulerCalls.length, 1)
})
