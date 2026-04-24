const bindEnv = env => {
  if (!env || typeof process === 'undefined' || !process.env) {
    return
  }

  Object.assign(process.env, env)
}

const loadRuntimeModules = async () => {
  const [appModule, envModule, courseLifecycleModule, packageLifecycleModule, deliveryModule, getSupabaseClientModule] = await Promise.all([
    import('./app.js'),
    import('./config/env.js'),
    import('./utils/courseLifecycle.js'),
    import('./utils/packageLifecycle.js'),
    import('./shared/services/groupResultNotificationDelivery.js'),
    import('./utils/getSupabaseClient.js')
  ])

  return {
    app: appModule.default || appModule,
    configEnv: (envModule.default || envModule).env,
    syncAllCourseLifecycles: (courseLifecycleModule.default || courseLifecycleModule).syncAllCourseLifecycles,
    syncAllPackageLifecycles: (packageLifecycleModule.default || packageLifecycleModule).syncAllPackageLifecycles,
    processPendingGroupResultNotificationJobs:
      (deliveryModule.default || deliveryModule).processPendingGroupResultNotificationJobs,
    getSupabaseClient: (getSupabaseClientModule.default || getSupabaseClientModule).getSupabaseClient
  }
}

export default {
  async fetch(request, env, ctx) {
    bindEnv(env)
    const { app } = await loadRuntimeModules()
    return app.fetch(request, env, ctx)
  },

  async scheduled(controller, env, ctx) {
    bindEnv(env)
    const {
      configEnv,
      syncAllCourseLifecycles,
      syncAllPackageLifecycles,
      processPendingGroupResultNotificationJobs,
      getSupabaseClient
    } = await loadRuntimeModules()
    const supabase = configEnv.useMySqlRepositories ? null : getSupabaseClient()
    ctx.waitUntil(
      Promise.all([
        syncAllCourseLifecycles({
          now: new Date(controller.scheduledTime).toISOString()
        }).catch(error => {
          console.error('[scheduled] course lifecycle sync failed', error)
        }),
        syncAllPackageLifecycles({
          now: new Date(controller.scheduledTime).toISOString()
        }).catch(error => {
          console.error('[scheduled] package lifecycle sync failed', error)
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
