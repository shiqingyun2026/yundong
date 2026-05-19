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
  sectionNode('协议主体', [
    paragraphNode('甲方：天天体育宝（深圳市龙岗区快虾科技工作室）'),
    paragraphNode('乙方：用户（学员法定监护人）'),
    paragraphNode('欢迎使用天天体育宝课程服务。请您（即学员法定监护人）仔细阅读本协议的全部内容，并确认理解并同意后，再进行课程购买及使用。')
  ]),
  sectionNode('第一条 账户注册与信息填报', [
    paragraphNode('1. 信息真实性'),
    paragraphNode('乙方在天天体育宝官方平台（包括小程序、APP等）注册账户及报名时，须如实、完整地填写监护人本人的联系电话以及学员的基本信息。'),
    paragraphNode('2. 联络责任'),
    paragraphNode('乙方提供的联系方式（手机号、微信号等）是甲方发送上课通知、紧急联络及处理售后事宜的唯一凭证。如因信息虚假、错误或未及时更新导致无法接收通知、错过课程或产生安全隐患，相关责任由乙方自行承担。'),
    paragraphNode('3. 订单确认'),
    paragraphNode('乙方在下单前应仔细核对课程种类、时间、地点及金额。支付完成后，视为乙方已确认订单详情无误。如有异议，须在开课前及时联系客服协调。')
  ]),
  sectionNode('第二条 安全责任与风险告知', [
    paragraphNode('1. 甲方作为课程的组织者，应对训练场地、设施的安全性负责，并配备具备相应资质的教练员，在训练过程中履行专业指导、安全监督和及时救助的义务。'),
    paragraphNode('2. 乙方确认学员身体状况适合参加所报课程，并承诺如实告知学员的健康状况。因乙方隐瞒学员不适宜运动的病情而导致的损害，由乙方自行承担主要责任。'),
    paragraphNode('3. 体育活动存在一定的固有风险，如意外扭伤、擦伤等。对于因学员自身原因、学员之间正常身体接触或其他非因甲方过错导致的意外，甲方依法不承担赔偿责任；但如损害系因甲方未尽到安全保障、管理或专业指导义务所致，甲方应依法承担相应责任。'),
    paragraphNode('4. 因甲方或其工作人员存在故意、过失，或因其提供的场地、器材不符合安全标准，导致学员发生人身损害的，甲方应依法承担相应的赔偿责任。'),
    paragraphNode('5. 建议乙方为学员购买覆盖此类培训活动的商业人身意外伤害保险，提升风险抵御能力。')
  ]),
  sectionNode('第三条 课程安排与场地规则', [
    paragraphNode('1. 课程时长：常规单次课程时长为60至90分钟，具体以乙方购买的产品说明为准（如出现特殊情况，甲方会及时联系乙方协商）。'),
    paragraphNode('2. 考勤纪律：乙方及学员须严格遵守预约时间，不得无故迟到、早退。如因乙方原因错过集合时间，甲方有权不予等候且不承担补课责任。'),
    paragraphNode('3. 场地使用：课程通常在小区绿地、公共运动场或甲方指定的合作场馆进行。若涉及特定场馆的租赁费用或场地管理费，原则上由乙方分摊或由甲方统一代缴，具体以课前通知为准。')
  ]),
  sectionNode('第四条 请假、延期与退课机制', [
    paragraphNode('1. 不可抗力'),
    paragraphNode('如遇极端恶劣天气（如台风、暴雨、重度雾霾等）或其他不可抗力因素，甲方有权调整课程时间或取消课程，并提前通知乙方。因甲方取消课程的，该次课时不予扣除，由双方协商补课或顺延。'),
    paragraphNode('2. 请假制度'),
    paragraphNode('(1) 乙方因个人原因需为学员请假，应至少提前24小时通过甲方指定渠道（如客服微信或平台消息）告知。'),
    paragraphNode('(2) 单个学员请假：由于课程为团体授课，单个学员缺席通常不影响整体课程正常进行，甲方可正常消耗该学员的当次课时，不予退费，亦不提供录播。但经甲方同意，乙方可将该次课程名额临时转让给符合课程条件的其他亲友使用，并应至少提前24小时提供受让人信息（姓名、年龄、监护人联系方式）。转让完成后，受让人可正常参课。'),
    paragraphNode('(3) 批量请假：若同一课程当日请假人数达到或超过总报名人数的50%，导致课程无法达到预期的教学效果，甲方有权决定将该次课程整体顺延，并提前通知所有学员。因甲方决定顺延的，所有学员该次课时不予扣除。'),
    paragraphNode('3. 转课限制'),
    paragraphNode('课程名额原则上仅限本人使用，但依据本条第2款第(2)项进行的单次临时转让除外。未经甲方书面同意，不得将整个剩余课程打包转让给他人。')
  ]),
  sectionNode('第五条 费用结算与支付方式', [
    paragraphNode('1. 支付方式：乙方应通过天天体育宝官方指定渠道完成支付，任何私下转账行为均视为无效。'),
    paragraphNode('2. 课程价格：各项目课程的具体价格、课时数、有效期，均以乙方在小程序内下单时页面公示的价格及订单详情为准。乙方完成支付即视为对订单所示全部信息的确认。'),
    paragraphNode('3. 合同解除与退费'),
    paragraphNode('(1) 开课前解除：乙方在开课前3天（含）以上提出退费申请的，甲方审核通过后予以全额退款。若乙方的退费导致该班次报名人数低于最低成团人数，该班次将自动取消，甲方应协助受影响的其他学员办理退费或调剂。'),
    paragraphNode('(2) 开课后解除：课程正式开始后，若乙方因个人原因申请解除合同并退费，甲方应予办理。甲方可在退还剩余款项前扣除已实际消耗的课时费；如双方在订单页面、报名须知或补充约定中已明确约定退费手续费或违约责任的，按该等约定执行；未作明确约定的，甲方不得再额外主张违约金。'),
    paragraphNode('(3) 因甲方原因解除：若因甲方原因（如教练长期缺失、场地变更导致无法正常上课）导致乙方无法继续履行合同，乙方有权解除合同，甲方应全额退还剩余课时费用。'),
    paragraphNode('4. 争议解决：本协议履行过程中发生争议，双方应友好协商解决；协商不成的，任何一方均可向合同履行地（即课程举办地）的人民法院提起诉讼。')
  ]),
  sectionNode('第六条 隐私保护与使用授权', [
    paragraphNode('1. 隐私保密：甲方承诺对乙方提交的个人信息严格保密，仅用于课程服务及教务管理，未经乙方同意不得向第三方泄露。'),
    paragraphNode('2. 肖像权使用：甲方可能对训练场景进行拍摄或录像，用于内部教学复盘或宣传推广。乙方有权通过书面方式通知甲方不同意或撤回授权；甲方在收到通知后，应停止对相关素材的后续宣传使用，并在合理范围内删除或替换尚未形成公开传播的相关内容。')
  ]),
  sectionNode('第七条 协议的变更与终止', [
    paragraphNode('1. 协议转让：在不影响课程正常组织和安全管理的前提下，乙方可在课程开始前申请将本协议项下剩余课程权益转让给符合条件的第三方（需满足年龄、体能等要求），并应取得甲方书面同意。'),
    paragraphNode('2. 协议解除'),
    paragraphNode('a. 甲方解除权：乙方或学员有下列情形之一的，甲方有权单方解除本协议，并视情况退还剩余费用：'),
    paragraphNode('（1）患有传染病等疾病，可能危害其他学员健康和安全，且未提前告知的；'),
    paragraphNode('（2）从事严重影响其他学员权益或严重扰乱教学秩序的活动，经劝阻仍不改正的；'),
    paragraphNode('（3）故意损坏场地、器材，造成较大损失的；'),
    paragraphNode('（4）法律规定的其他影响合同履行的情形。'),
    paragraphNode('b. 乙方解除权：出现以下情形之一的，乙方有权要求解除合同。退费标准按照本协议第五条第3款执行；如该条已有明确约定的，优先适用该条：'),
    paragraphNode('（1）因甲方原因（如教练缺失、场馆丧失使用权）导致连续3次无法正常上课的，乙方有权解除协议，甲方全额退还剩余课时费用；'),
    paragraphNode('（2）若课程设有最低成团人数，因未达到约定人数导致拼课失败的，乙方既不同意转团，也不同意延期或改换其他课程的，甲方应通知乙方，扣除已实际发生的必要费用后，将余款退还乙方。')
  ]),
  sectionNode('第八条 其他约定', [
    paragraphNode('1. 本协议自乙方在在线界面完成课程支付之日起生效，有效期至所购课时全部消耗完毕或协议约定的终止日期为止。'),
    paragraphNode('2. 本协议为电子协议，具有与纸质协议同等的法律效力。')
  ]),
  sectionNode('重要提示', [
    paragraphNode('在完成支付前，请您再次确认已充分理解并接受本协议的全部内容。如您不同意本协议的任何条款，请勿购买或使用天天体育宝课程服务。')
  ], false)
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
    subtitle: '版本发布日期：2026年5月19日  生效日期：2026年5月19日',
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
