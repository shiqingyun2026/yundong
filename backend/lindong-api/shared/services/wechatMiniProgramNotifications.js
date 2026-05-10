const { getWechatAccessToken, fetchJson } = require('./wechatMiniProgram')
const DEFAULT_HOME_PAGE_PATH = 'pages/home/index'

const readRequiredEnv = key => {
  const value = `${process.env[key] || ''}`.trim()
  if (!value) {
    throw new Error(`${key} is required for wechat delivery mode`)
  }
  return value
}

const parseFieldMap = envKey => {
  const raw = `${process.env[envKey] || ''}`.trim()
  if (!raw) {
    throw new Error(`${envKey} is required for wechat delivery mode`)
  }

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`${envKey} must be valid JSON`)
  }

  return parsed && typeof parsed === 'object' ? parsed : {}
}

const getTemplateFieldMapByTemplateKey = templateKey => {
  if (templateKey === 'groupSuccess') {
    const parsed = parseFieldMap('WX_GROUP_SUCCESS_TEMPLATE_FIELD_MAP')
    if (!parsed.groupCourse || !parsed.courseStartTime || !parsed.courseAddress || !parsed.warmTips) {
      throw new Error(
        'WX_GROUP_SUCCESS_TEMPLATE_FIELD_MAP must define groupCourse, courseStartTime, courseAddress and warmTips'
      )
    }

    return {
      groupCourse: parsed.groupCourse,
      courseStartTime: parsed.courseStartTime,
      courseAddress: parsed.courseAddress,
      warmTips: parsed.warmTips
    }
  }

  if (templateKey === 'groupFail') {
    const parsed = parseFieldMap('WX_GROUP_FAIL_TEMPLATE_FIELD_MAP')
    if (!parsed.groupCourse || !parsed.failedReason || !parsed.warmTips) {
      throw new Error('WX_GROUP_FAIL_TEMPLATE_FIELD_MAP must define groupCourse, failedReason and warmTips')
    }

    return {
      groupCourse: parsed.groupCourse,
      failedReason: parsed.failedReason,
      warmTips: parsed.warmTips
    }
  }

  throw new Error(`unsupported template key: ${templateKey || 'unknown'}`)
}

const buildPagePath = pagePath => {
  const value = `${pagePath || ''}`.trim()
  return (value.replace(/^\//, '') || DEFAULT_HOME_PAGE_PATH)
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

  if (snapshot.template_key === 'groupSuccess') {
    return {
      [fieldMap.groupCourse]: {
        value: truncateValue(snapshot.group_course, 20)
      },
      [fieldMap.courseStartTime]: {
        value: truncateValue(snapshot.course_start_time, 20)
      },
      [fieldMap.courseAddress]: {
        value: truncateValue(snapshot.course_address, 20)
      },
      [fieldMap.warmTips]: {
        value: truncateValue(snapshot.warm_tips, 20)
      }
    }
  }

  return {
    [fieldMap.groupCourse]: {
      value: truncateValue(snapshot.group_course, 20)
    },
    [fieldMap.failedReason]: {
      value: truncateValue(snapshot.failed_reason, 20)
    },
    [fieldMap.warmTips]: {
      value: truncateValue(snapshot.warm_tips, 20)
    }
  }
}

const sendGroupResultSubscribeMessage = async ({ openId, job }) => {
  if (!openId) {
    throw new Error('wechat recipient openid missing')
  }

  const templateKey = job && job.message_snapshot ? job.message_snapshot.template_key : ''
  const accessToken = await getWechatAccessToken()
  const fieldMap = getTemplateFieldMapByTemplateKey(templateKey)
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
