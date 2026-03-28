import { httpServerHandler } from 'cloudflare:node'

import app from './app.js'
import courseLifecycleModule from './utils/courseLifecycle.js'

const { syncAllCourseLifecycles } = courseLifecycleModule

app.listen(3000)

export default {
  ...httpServerHandler({ port: 3000 }),

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      syncAllCourseLifecycles({
        now: new Date(controller.scheduledTime).toISOString()
      }).catch(error => {
        console.error('[scheduled] course lifecycle sync failed', error)
      })
    )
  }
}
