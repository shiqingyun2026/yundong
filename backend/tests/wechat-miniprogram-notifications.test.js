const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'lindong-api')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const loadService = () => {
  const servicePath = require.resolve(path.join(backendRoot, 'shared/services/wechatMiniProgramNotifications.js'))
  const wechatServicePath = require.resolve(path.join(backendRoot, 'shared/services/wechatMiniProgram.js'))

  delete require.cache[servicePath]
  delete require.cache[wechatServicePath]

  const requests = []

  mockModule('shared/services/wechatMiniProgram.js', {
    getWechatAccessToken: async () => 'mock-access-token',
    fetchJson: async (url, options) => {
      requests.push({
        url,
        options
      })

      return {
        errcode: 0,
        errmsg: 'ok'
      }
    }
  })

  return {
    ...require(servicePath),
    requests
  }
}

test('wechat mini program subscribe message falls back to home page when page_path is empty', async () => {
  process.env.WX_GROUP_SUCCESS_TEMPLATE_FIELD_MAP = JSON.stringify({
    groupCourse: 'thing1',
    courseStartTime: 'date2',
    courseAddress: 'thing3',
    warmTips: 'thing4'
  })
  process.env.WX_MINIPROGRAM_STATE = 'formal'

  const { sendGroupResultSubscribeMessage, requests } = loadService()

  await sendGroupResultSubscribeMessage({
    openId: 'openid-1',
    job: {
      template_id: 'tpl-1',
      page_path: '',
      message_snapshot: {
        template_key: 'groupSuccess',
        group_course: '少儿体适能基础课(4人团)',
        course_start_time: '2026-05-16 10:00:00',
        course_address: '科技园 邻动运动馆',
        warm_tips: '客服稍后将联系您，请保持通话畅通'
      }
    }
  })

  assert.equal(requests.length, 1)
  const payload = JSON.parse(requests[0].options.body)
  assert.equal(payload.page, 'pages/home/index')
})
