const { post } = require('./request')

const SUBSCRIPTION_SCENE_GROUP_RESULT = 'group_result'

const resolveGroupResultTemplateId = () => {
  try {
    const app = getApp()
    const subscribeTemplateIds = (app && app.globalData && app.globalData.subscribeTemplateIds) || {}
    return subscribeTemplateIds.groupResult || ''
  } catch (error) {
    return ''
  }
}

const requestGroupResultSubscription = ({ groupId, courseId }) =>
  new Promise(resolve => {
    const templateId = resolveGroupResultTemplateId()

    if (!templateId) {
      resolve({
        ok: false,
        skipped: true,
        reason: 'template_not_configured',
        templateId: ''
      })
      return
    }

    if (!wx.requestSubscribeMessage) {
      resolve({
        ok: false,
        skipped: true,
        reason: 'api_not_supported',
        templateId
      })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(result) {
        const decision = result && result[templateId] ? result[templateId] : 'unknown'
        resolve({
          ok: decision === 'accept',
          skipped: false,
          reason: '',
          templateId,
          decision,
          rawResult: result || null,
          groupId: groupId || '',
          courseId: courseId || ''
        })
      },
      fail(error) {
        resolve({
          ok: false,
          skipped: false,
          reason: 'request_failed',
          templateId,
          decision: 'error',
          rawResult: error || null,
          groupId: groupId || '',
          courseId: courseId || ''
        })
      }
    })
  })

const reportGroupResultSubscription = payload =>
  post(
    '/api/user/group-result-subscriptions',
    {
      scene: SUBSCRIPTION_SCENE_GROUP_RESULT,
      templateKey: 'groupResult',
      templateId: payload && payload.templateId ? payload.templateId : '',
      groupId: payload && payload.groupId ? payload.groupId : '',
      courseId: payload && payload.courseId ? payload.courseId : '',
      decision: payload && payload.decision ? payload.decision : 'unknown',
      status: payload && payload.ok ? 'subscribed' : payload && payload.skipped ? 'skipped' : 'unsubscribed',
      reason: payload && payload.reason ? payload.reason : '',
      rawResult: payload && payload.rawResult ? payload.rawResult : null
    },
    {
      showErrorToast: false
    }
  )

module.exports = {
  requestGroupResultSubscription,
  reportGroupResultSubscription,
  resolveGroupResultTemplateId,
  SUBSCRIPTION_SCENE_GROUP_RESULT
}
