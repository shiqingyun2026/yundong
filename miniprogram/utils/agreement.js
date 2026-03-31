const userAgreementNodes = [
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 32rpx;'
    },
    children: [
      {
        name: 'h3',
        attrs: {
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '一、服务说明' }]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '邻动体适能小程序当前为测试阶段占位协议内容，后续将替换为正式《用户协议》。用户在使用课程浏览、报名、拼团等服务前，应先完整阅读并确认同意本协议。'
          }
        ]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '在正式版本中，这里将补充平台服务范围、用户账号规则、订单与支付条款、退款说明、知识产权及争议解决条款。'
          }
        ]
      }
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
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '二、用户义务' }]
      },
      {
        name: 'ul',
        attrs: {
          style: 'padding-left: 32rpx;'
        },
        children: [
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '需确保提交的信息真实、准确、完整。' }]
          },
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '应合理使用小程序，不得进行影响平台安全或正常运营的行为。' }]
          },
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '下单、拼团、支付等行为将以后续正式协议和平台规则为准。' }]
          }
        ]
      }
    ]
  }
]

const privacyPolicyNodes = [
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 32rpx;'
    },
    children: [
      {
        name: 'h3',
        attrs: {
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '一、信息收集范围' }]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '当前展示内容为《隐私政策》占位文本，后续将替换为正式版本。为实现登录、定位、拼团、支付与客服能力，平台可能收集昵称头像、手机号、地理位置、订单信息等必要数据。'
          }
        ]
      }
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
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '二、信息使用与保护' }]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '平台仅在实现产品功能、履行法律义务与提升服务体验的范围内使用信息，并会在正式版本中补充保存期限、第三方共享、用户查询更正删除等条款。'
          }
        ]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '如用户不同意本政策，则无法继续使用需要信息处理支持的小程序核心能力。'
          }
        ]
      }
    ]
  }
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
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '一、协议说明' }]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '当前《课程服务协议》为开发测试阶段的临时文本，用于支付确认页阅读与跳转验证。后续会替换为正式协议内容。'
          }
        ]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '用户在购买课程、参与拼团与发起支付前，应自行阅读课程说明、拼团规则、退款规则与服务约定；继续支付即视为理解并接受相关规则。'
          }
        ]
      }
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
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '二、课程与拼团规则' }]
      },
      {
        name: 'ul',
        attrs: {
          style: 'padding-left: 32rpx;'
        },
        children: [
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '课程价格、上课时间、地点、适龄范围以页面实际展示为准。' }]
          },
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '拼团是否成团、截止时间及成团人数以订单与拼团页实时状态为准。' }]
          },
          {
            name: 'li',
            attrs: {
              style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
            },
            children: [{ type: 'text', text: '未成团订单的退款方式、退款时效以后续正式协议及平台规则为准。' }]
          }
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
          style: 'margin-bottom: 16rpx; font-size: 32rpx; font-weight: 700; color: #1f2329;'
        },
        children: [{ type: 'text', text: '三、特别提示' }]
      },
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '本页内容仅为临时占位文本，方便当前开发联调与测试使用。后续如你提供正式条款，我可以直接替换成正式版服务协议。'
          }
        ]
      }
    ]
  }
]

const AGREEMENT_DOCS = [
  {
    key: 'user',
    title: '用户协议',
    subtitle: '当前为临时占位文本，后续可替换为正式用户协议。',
    nodes: userAgreementNodes
  },
  {
    key: 'privacy',
    title: '隐私政策',
    subtitle: '当前为临时占位文本，后续可替换为正式隐私政策。',
    nodes: privacyPolicyNodes
  },
  {
    key: 'course-service',
    title: '课程服务协议',
    subtitle: '当前为临时占位文本，后续可替换为正式课程服务协议。',
    nodes: courseServiceAgreementNodes
  }
]

const getAgreementDocByKey = key => {
  const matched = AGREEMENT_DOCS.find(item => item.key === key)
  return matched || AGREEMENT_DOCS[0]
}

module.exports = {
  AGREEMENT_DOCS,
  getAgreementDocByKey,
  userAgreementNodes,
  privacyPolicyNodes,
  courseServiceAgreementNodes
}
