import app from './app.js'
import courseLifecycleModule from './utils/courseLifecycle.js'

const { syncAllCourseLifecycles } = courseLifecycleModule

const bindEnv = env => {
  if (!env || typeof process === 'undefined' || !process.env) {
    return
  }

  Object.assign(process.env, env)
}

export default {
  async fetch(request, env, ctx) {
    bindEnv(env)
    return app.fetch(request, env, ctx)
  },

  async scheduled(controller, env, ctx) {
    bindEnv(env)
    ctx.waitUntil(
      syncAllCourseLifecycles({
        now: new Date(controller.scheduledTime).toISOString()
      }).catch(error => {
        console.error('[scheduled] course lifecycle sync failed', error)
      })
    )
  }
}
