const sectionStyle = hasMargin => `margin-bottom: ${hasMargin ? '32rpx' : '0'};`
const headingStyle = 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
const subheadingStyle = 'margin: 24rpx 0 12rpx; font-size: 28rpx; font-weight: 600; color: #1f2329;'
const paragraphStyle = 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
const listStyle = 'padding-left: 32rpx; margin: 0;'
const listItemStyle = 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'

const textNode = text => ({
  type: 'text',
  text
})

const headingNode = (level, text) => ({
  name: level,
  attrs: {
    style: level === 'h3' ? headingStyle : subheadingStyle
  },
  children: [textNode(text)]
})

const paragraphNode = text => ({
  name: 'p',
  attrs: {
    style: paragraphStyle
  },
  children: [textNode(text)]
})

const listItemNode = text => ({
  name: 'li',
  attrs: {
    style: listItemStyle
  },
  children: [textNode(text)]
})

const listNode = items => ({
  name: 'ul',
  attrs: {
    style: listStyle
  },
  children: items.map(listItemNode)
})

const sectionNode = (title, children, hasMargin = true) => ({
  name: 'div',
  attrs: {
    style: sectionStyle(hasMargin)
  },
  children: [headingNode('h3', title), ...children]
})

const userAgreementNodes = [
  sectionNode('1. 总则', [
    paragraphNode('欢迎使用由“深圳市龙岗区快虾科技工作室”（以下称“我们”或“本平台”）运营的天天体育宝小程序。本协议是您与我们之间关于使用本小程序服务的法律协议。您通过点击“同意并进入”并继续使用，即表示您已充分阅读、理解并接受本协议的全部内容。')
  ]),
  sectionNode('2. 账号注册与登录', [
    listNode([
      '您需通过微信授权登录。我们仅通过微信登录获取您的微信用户唯一标识（openid），用于创建账号。我们不会主动获取您的微信头像、昵称。',
      '您应对您的账号行为负责，不得转让或出借账号。'
    ])
  ]),
  sectionNode('3. 服务内容', [
    paragraphNode('本小程序提供：'),
    listNode([
      '课程信息浏览（课程名称、时间、地点、价格、教练、保险说明等）；',
      '拼团购买课程（开团、参团、查看拼团进度）；',
      '在线支付；',
      '我的拼团记录查看。'
    ])
  ]),
  sectionNode('4. 拼团与支付规则', [
    listNode([
      '成团条件：拼团需在有效期内达到规定人数。达到人数后自动成团，未达到则自动退款（通过微信支付原路返回）。',
      '真实支付：您确认支付后，将通过微信支付接口完成扣款。支付成功后订单生效，不可撤销。如拼团失败，款项将自动退回您的微信支付账户。',
      '支付安全：我们不会存储您的银行卡号、密码等敏感信息。支付过程由微信支付提供安全保障。'
    ])
  ]),
  sectionNode('5. 用户行为规范', [
    paragraphNode('您不得利用本小程序：'),
    listNode([
      '发布违法、色情、暴力、虚假信息；',
      '恶意刷单、虚假拼团、套取优惠；',
      '攻击小程序系统、窃取数据；',
      '侵犯他人知识产权或隐私权。'
    ])
  ]),
  sectionNode('6. 退款与售后', [
    listNode([
      '拼团失败退款：自动原路退回，无需申请。',
      '其他情况退款：因课程取消等非用户原因，请联系客服邮箱（tiantiantiyubao@qq.com）处理。用户主动放弃参团或支付成功后要求退款，原则上不予支持，具体以课程详情页说明为准。'
    ])
  ]),
  sectionNode('7. 免责声明', [
    listNode([
      '因不可抗力（自然灾害、战争、政策变化）或第三方原因（微信平台故障、网络攻击）导致服务中断或数据丢失，我们不承担责任。',
      '课程内容由合作方提供，我们不对课程实际效果、安全做任何承诺。用户与课程提供方之间的纠纷应自行解决。'
    ])
  ]),
  sectionNode('8. 协议修改', [
    paragraphNode('我们有权修改本协议，修改后的协议将在小程序内公告。如您不同意修改，请停止使用服务；继续使用视为同意修改。')
  ]),
  sectionNode('9. 法律适用与争议解决', [
    paragraphNode('本协议适用中华人民共和国法律。因本协议产生的争议，双方应协商解决；协商不成的，任何一方可向深圳市龙岗区人民法院提起诉讼。')
  ]),
  sectionNode('10. 联系方式', [
    paragraphNode('客服邮箱：tiantiantiyubao@qq.com（唯一官方渠道）')
  ], false)
]

const privacyPolicyNodes = [
  sectionNode('1. 我们收集的信息', [
    headingNode('h4', '1.1 必要信息（未提供无法使用）'),
    listNode([
      '微信用户唯一标识（openid）：通过微信静默登录获取，用于创建您的账号，区分不同用户。',
      '用户协议同意记录：存储您是否同意本协议和隐私政策，用于满足法律法规要求。',
      '系统生成的昵称与默认头像：我们为您自动分配初始昵称（如“用户1234”）和默认头像。这些信息不涉及您的个人真实信息。'
    ]),
    headingNode('h4', '1.2 可选信息（可拒绝，拒绝后部分功能受影响）'),
    listNode([
      '地理位置：当您使用“按距离排序”或“附近课程”功能时，我们会申请获取您的地理位置。您可拒绝授权，拒绝后课程列表按默认顺序展示。'
    ]),
    headingNode('h4', '1.3 支付信息'),
    listNode([
      '订单信息：包括课程名称、金额、订单号、支付时间。这些信息用于完成支付、订单核对及售后服务。',
      '交易单号：由微信支付提供，用于查询交易状态和退款。',
      '我们不会收集：您的银行卡号、密码、微信支付密码等敏感信息。'
    ])
  ]),
  sectionNode('2. 我们如何使用您的信息', [
    listNode([
      '创建和管理您的账号；',
      '展示课程、处理拼团、完成支付；',
      '根据地理位置推荐附近课程（需您授权）；',
      '保障系统安全、预防欺诈；',
      '履行法律法规义务（如交易记录保存）。'
    ])
  ]),
  sectionNode('3. 我们如何共享、转让、公开披露您的信息', [
    listNode([
      '共享：仅与提供支付服务的微信支付共享必要的订单信息，以及与课程合作方共享您参与的课程和拼团状态。我们要求合作方遵守保密义务。',
      '转让：未经您同意，不会转让您的信息，除非公司合并、分立等情形。',
      '公开披露：仅在法律要求或为保护重大权益时披露。'
    ])
  ]),
  sectionNode('4. 您如何管理您的信息', [
    listNode([
      '访问与更正：您可以在“我的”页面查看您的昵称和头像（默认或自定义）。如需要修改，可通过客服邮箱联系我们（未来会增加自助编辑功能）。',
      '删除账号：您可发送邮件至 tiantiantiyubao@qq.com 申请删除账号。我们将在15个工作日内处理，删除后您的所有信息将被清除（法律法规要求保留的除外）。',
      '撤回同意：您可以通过删除小程序或取消微信授权来撤回同意，但这可能导致无法使用服务。'
    ])
  ]),
  sectionNode('5. 信息存储与保护', [
    listNode([
      '存储地点：中国大陆境内。',
      '存储期限：从您注册账号到您注销账号，或法律法规要求的更长期限（如交易记录至少保存3年）。',
      '安全措施：我们采用HTTPS加密传输、访问控制、定期备份等措施。但请注意，任何互联网传输都无法保证100%安全。'
    ])
  ]),
  sectionNode('6. 未成年人保护', [
    paragraphNode('本小程序主要面向成年人。如果您是未成年人，请在监护人指导下使用。我们不会主动收集未成年人的个人信息。')
  ]),
  sectionNode('7. 政策更新', [
    paragraphNode('本政策可能更新。我们会通过弹窗或公告方式通知您，继续使用即表示同意更新后的政策。')
  ]),
  sectionNode('8. 联系我们', [
    paragraphNode('如您对本政策有任何疑问、投诉或需要行使您的权利，请联系：'),
    paragraphNode('客服邮箱：tiantiantiyubao@qq.com（唯一官方联系方式）')
  ], false)
]

const courseServiceAgreementNodes = [
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 32rpx;'
    },
    children: [
      {
        name: 'h3',
        attrs: {
          style: headingStyle
        },
        children: [textNode('一、协议说明')]
      },
      paragraphNode('当前《课程服务协议》为开发测试阶段的临时文本，用于支付确认页阅读与跳转验证。后续会替换为正式协议内容。'),
      paragraphNode('用户在购买课程、参与拼团与发起支付前，应自行阅读课程说明、拼团规则、退款规则与服务约定；继续支付即视为理解并接受相关规则。')
    ]
  },
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 32rpx;'
    },
    children: [
      {
        name: 'h3',
        attrs: {
          style: headingStyle
        },
        children: [textNode('二、课程与拼团规则')]
      },
      {
        name: 'ul',
        attrs: {
          style: listStyle
        },
        children: [
          listItemNode('课程价格、上课时间、地点、适龄范围以页面实际展示为准。'),
          listItemNode('拼团是否成团、截止时间及成团人数以订单与拼团页实时状态为准。'),
          listItemNode('未成团订单的退款方式、退款时效以后续正式协议及平台规则为准。')
        ]
      }
    ]
  },
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 0;'
    },
    children: [
      {
        name: 'h3',
        attrs: {
          style: headingStyle
        },
        children: [textNode('三、特别提示')]
      },
      paragraphNode('本页内容仅为临时占位文本，方便当前开发联调与测试使用。后续如你提供正式条款，我可以直接替换成正式版服务协议。')
    ]
  }
]

const AGREEMENT_DOCS = [
  {
    key: 'user',
    title: '用户协议',
    subtitle: '版本发布日期：2026年4月25日  生效日期：2026年4月25日',
    nodes: userAgreementNodes
  },
  {
    key: 'privacy',
    title: '隐私政策',
    subtitle: '更新日期：2026年4月25日  生效日期：2026年4月25日',
    nodes: privacyPolicyNodes
  },
  {
    key: 'course-service',
    title: '课程服务协议',
    subtitle: '当前为临时占位文本，后续可替换为正式课程服务协议。',
    nodes: courseServiceAgreementNodes
  }
]

const cloneNodes = nodes => JSON.parse(JSON.stringify(nodes))

const getAgreementPageContent = () => ({
  userAgreementNodes: cloneNodes(userAgreementNodes),
  privacyPolicyNodes: cloneNodes(privacyPolicyNodes)
})

const getCourseServiceAgreementNodes = () => cloneNodes(courseServiceAgreementNodes)

const getAgreementDocByKey = key => {
  const matched = AGREEMENT_DOCS.find(item => item.key === key)
  const target = matched || AGREEMENT_DOCS[0]

  return {
    ...target,
    nodes: cloneNodes(target.nodes)
  }
}

module.exports = {
  AGREEMENT_DOCS,
  getAgreementPageContent,
  getCourseServiceAgreementNodes,
  getAgreementDocByKey,
  userAgreementNodes,
  privacyPolicyNodes,
  courseServiceAgreementNodes
}
