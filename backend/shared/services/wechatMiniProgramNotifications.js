const { getWechatAccessToken, fetchJson } = require('./wechatMiniProgram')

const readRequiredEnv = key => {
  const value = `${process.env[key] || ''}`.trim()
  if (!value) {
    throw new Error(`${key} is required for wechat delivery mode`)
  }
  return value
}

const parseTemplateFieldMap = () => {
  const raw = `${process.env.WX_GROUP_RESULT_TEMPLATE_FIELD_MAP || ''}`.trim()
  if (!raw) {
    throw new Error('WX_GROUP_RESULT_TEMPLATE_FIELD_MAP is required for wechat delivery mode')
  }

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error('WX_GROUP_RESULT_TEMPLATE_FIELD_MAP must be valid JSON')
  }

  const normalized = {
    title: parsed.title || '',
    resultText: parsed.resultText || '',
    actionText: parsed.actionText || '',
    courseStartTime: parsed.courseStartTime || '',
    courseAddress: parsed.courseAddress || ''
  }

  if (!normalized.title || !normalized.resultText || !normalized.actionText) {
    throw new Error('WX_GROUP_RESULT_TEMPLATE_FIELD_MAP must define title, resultText and actionText')
  }

  return normalized
}

const buildPagePath = pagePath => {
  const value = `${pagePath || ''}`.trim()
  return value.replace(/^\//, '')
}

const truncateValue = (value, maxLength = 20) => {
  const text = `${value || ''}`.trim()
  if (!text) {
    return '-'
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

const buildTemplateData = (job, fieldMap) => {
  const snapshot = job && job.message_snapshot ? job.message_snapshot : {}
  const data = {}

  data[fieldMap.title] = {
    value: truncateValue(snapshot.title, 20)
  }
  data[fieldMap.resultText] = {
    value: truncateValue(snapshot.result_text, 20)
  }
  data[fieldMap.actionText] = {
    value: truncateValue(snapshot.action_text, 20)
  }

  if (fieldMap.courseStartTime) {
    data[fieldMap.courseStartTime] = {
      value: truncateValue(snapshot.course_start_time, 20)
    }
  }

  if (fieldMap.courseAddress) {
    data[fieldMap.courseAddress] = {
      value: truncateValue(snapshot.course_address, 20)
    }
  }

  return data
}

const sendGroupResultSubscribeMessage = async ({ openId, job }) => {
  if (!openId) {
    throw new Error('wechat recipient openid missing')
  }

  const accessToken = await getWechatAccessToken()
  const fieldMap = parseTemplateFieldMap()
  const miniprogramState = `${process.env.WX_MINIPROGRAM_STATE || 'developer'}`.trim()
  const payload = {
    touser: openId,
    template_id: job.template_id,
    page: buildPagePath(job.page_path),
    miniprogram_state: miniprogramState,
    data: buildTemplateData(job, fieldMap)
  }

  const response = await fetchJson(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  )

  if (response && response.errcode && response.errcode !== 0) {
    throw new Error(response.errmsg || `wechat send failed: ${response.errcode}`)
  }

  return response
}

module.exports = {
  sendGroupResultSubscribeMessage
}
