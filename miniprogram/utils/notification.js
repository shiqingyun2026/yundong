const { post } = require('./request')

const SUBSCRIPTION_SCENE_GROUP_RESULT = 'group_result'
const TEMPLATE_KEY_GROUP_SUCCESS = 'groupSuccess'
const TEMPLATE_KEY_GROUP_FAIL = 'groupFail'

const resolveGroupResultTemplateIds = () => {
  try {
    const app = getApp()
    const subscribeTemplateIds = (app && app.globalData && app.globalData.subscribeTemplateIds) || {}
    return {
      groupSuccess: subscribeTemplateIds.groupSuccess || '',
      groupFail: subscribeTemplateIds.groupFail || ''
    }
  } catch (error) {
    return {
      groupSuccess: '',
      groupFail: ''
    }
  }
}

const buildSubscriptions = ({ templateIds = {}, result = null, fallbackDecision = 'unknown' }) => ({
  [TEMPLATE_KEY_GROUP_SUCCESS]: {
    templateId: templateIds.groupSuccess || '',
    decision:
      templateIds.groupSuccess && result && result[templateIds.groupSuccess]
        ? result[templateIds.groupSuccess]
        : fallbackDecision
  },
  [TEMPLATE_KEY_GROUP_FAIL]: {
    templateId: templateIds.groupFail || '',
    decision:
      templateIds.groupFail && result && result[templateIds.groupFail]
        ? result[templateIds.groupFail]
        : fallbackDecision
  }
})

const requestGroupResultSubscription = ({ groupId, courseId }) =>
  new Promise(resolve => {
    const templateIds = resolveGroupResultTemplateIds()
    const tmplIds = [templateIds.groupSuccess, templateIds.groupFail].filter(Boolean)

    if (!tmplIds.length) {
      resolve({
        ok: false,
        skipped: true,
        reason: 'template_not_configured',
        templateIds,
        subscriptions: buildSubscriptions({ templateIds })
      })
      return
    }

    if (!wx.requestSubscribeMessage) {
      resolve({
        ok: false,
        skipped: true,
        reason: 'api_not_supported',
        templateIds,
        subscriptions: buildSubscriptions({ templateIds })
      })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds,
      success(result) {
        const subscriptions = buildSubscriptions({
          templateIds,
          result
        })
        const acceptedKeys = Object.keys(subscriptions).filter(
          key => subscriptions[key].templateId && subscriptions[key].decision === 'accept'
        )

        resolve({
          ok: acceptedKeys.length > 0,
          skipped: false,
          reason: '',
          templateIds,
          subscriptions,
          acceptedKeys,
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
          templateIds,
          subscriptions: buildSubscriptions({
            templateIds,
            fallbackDecision: 'error'
          }),
          acceptedKeys: [],
          rawResult: error || null,
          groupId: groupId || '',
          courseId: courseId || ''
        })
      }
    })
  })

const reportSingleGroupResultSubscription = ({
  payload,
  templateKey,
  templateId,
  decision
}) =>
  post(
    '/api/user/group-result-subscriptions',
    {
      scene: SUBSCRIPTION_SCENE_GROUP_RESULT,
      templateKey,
      templateId: templateId || '',
      groupId: payload && payload.groupId ? payload.groupId : '',
      courseId: payload && payload.courseId ? payload.courseId : '',
      decision: decision || 'unknown',
      status:
        decision === 'accept'
          ? 'subscribed'
          : payload && payload.skipped
            ? 'skipped'
            : 'unsubscribed',
      reason: payload && payload.reason ? payload.reason : '',
      rawResult: payload && payload.rawResult ? payload.rawResult : null
    },
    {
      showErrorToast: false
    }
  )

const reportGroupResultSubscription = payload => {
  const subscriptions = (payload && payload.subscriptions) || {}
  const tasks = []

  const successSubscription = subscriptions[TEMPLATE_KEY_GROUP_SUCCESS]
  if (successSubscription && successSubscription.templateId) {
    tasks.push(
      reportSingleGroupResultSubscription({
        payload,
        templateKey: TEMPLATE_KEY_GROUP_SUCCESS,
        templateId: successSubscription.templateId,
        decision: successSubscription.decision
      })
    )
  }

  const failSubscription = subscriptions[TEMPLATE_KEY_GROUP_FAIL]
  if (failSubscription && failSubscription.templateId) {
    tasks.push(
      reportSingleGroupResultSubscription({
        payload,
        templateKey: TEMPLATE_KEY_GROUP_FAIL,
        templateId: failSubscription.templateId,
        decision: failSubscription.decision
      })
    )
  }

  if (!tasks.length) {
    return Promise.resolve()
  }

  return Promise.allSettled(tasks)
}

module.exports = {
  requestGroupResultSubscription,
  reportGroupResultSubscription,
  resolveGroupResultTemplateIds,
  SUBSCRIPTION_SCENE_GROUP_RESULT
}
