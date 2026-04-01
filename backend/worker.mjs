import app from './app.js'
import courseLifecycleModule from './utils/courseLifecycle.js'
import deliveryModule from './shared/services/groupResultNotificationDelivery.js'
import supabase from './utils/supabase.js'

const { syncAllCourseLifecycles } = courseLifecycleModule
const { processPendingGroupResultNotificationJobs } = deliveryModule

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
      Promise.all([
        syncAllCourseLifecycles({
          now: new Date(controller.scheduledTime).toISOString()
        }).catch(error => {
          console.error('[scheduled] course lifecycle sync failed', error)
        }),
        processPendingGroupResultNotificationJobs({
          supabase,
          limit: env && env.GROUP_RESULT_NOTIFICATION_BATCH_SIZE ? env.GROUP_RESULT_NOTIFICATION_BATCH_SIZE : undefined,
          mode: env && env.GROUP_RESULT_NOTIFICATION_DELIVERY_MODE ? env.GROUP_RESULT_NOTIFICATION_DELIVERY_MODE : undefined
        }).catch(error => {
          console.error('[scheduled] group result notification delivery failed', error)
        })
      ])
    )
  }
}
