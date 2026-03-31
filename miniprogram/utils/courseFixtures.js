const SERVICE_QR_CODE = 'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D%E4%BA%8C%E7%BB%B4%E7%A0%81'

const buildDescriptionNodes = title => [
  {
    name: 'div',
    attrs: {
      style: 'margin-bottom: 24rpx;'
    },
    children: [
      {
        name: 'p',
        attrs: {
          style: 'margin-bottom: 16rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: `${title}采用小班制教学，结合跑、跳、钻、爬与趣味游戏，让孩子在家门口也能完成系统的体适能训练。`
          }
        ]
      },
      {
        name: 'p',
        attrs: {
          style: 'color: #3c4655; line-height: 1.8;'
        },
        children: [
          {
            type: 'text',
            text: '课程将根据孩子年龄与体能水平进行分层引导，帮助提升协调性、平衡力、反应力与社交参与感。'
          }
        ]
      }
    ]
  }
]

const GROUP_RULE_NODES = [
  {
    name: 'ul',
    attrs: {
      style: 'padding-left: 30rpx;'
    },
    children: [
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '每个课程仅有一个进行中的拼团，先到先得。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '达到成团人数自动成团，未达到则自动原路退款。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '所有成员均可邀请好友加入，无团长角色。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '拼团成功后不可退款，如有疑问请联系客服。' }]
      }
    ]
  }
]

const PAYMENT_GROUP_NOTE_NODES = [
  {
    name: 'ul',
    attrs: {
      style: 'padding-left: 30rpx;'
    },
    children: [
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '每个课程仅开放一个进行中的拼团，请尽快完成支付。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'margin-bottom: 14rpx; color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '达到成团人数后自动成团，课程名额将按支付顺序锁定。' }]
      },
      {
        name: 'li',
        attrs: {
          style: 'color: #3c4655; line-height: 1.8;'
        },
        children: [{ type: 'text', text: '若截止前未成团，系统将自动原路退款。' }]
      }
    ]
  }
]

const MOCK_COURSES = [
  {
    id: 'course-101',
    cover: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    title: '少儿户外体能基础课',
    startTime: '2026-03-28T10:00:00+08:00',
    endTime: '2026-03-28T11:00:00+08:00',
    location: '北京市 朝阳区 · 望京花园中心草坪',
    groupPrice: 9900,
    originalPrice: 15900,
    joinedCount: 3,
    targetCount: 5,
    distanceKm: 1.2,
    ageRange: '4-7岁',
    images: [
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '王教练',
    coachIntro: '拥有 6 年儿童体适能教学经验，擅长通过游戏化训练提升孩子参与度与运动自信。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E6%95%99%E7%BB%83%E8%AF%81%E4%B9%A61',
      'https://dummyimage.com/240x160/f6f7fb/1677ff.png&text=%E6%95%99%E7%BB%83%E8%AF%81%E4%B9%A62'
    ]
  },
  {
    id: 'course-102',
    cover: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    title: '周末亲子协调训练营',
    startTime: '2026-03-26T15:30:00+08:00',
    endTime: '2026-03-26T16:30:00+08:00',
    location: '北京市 海淀区 · 中关村森林公园',
    groupPrice: 12800,
    originalPrice: 18800,
    joinedCount: 4,
    targetCount: 5,
    distanceKm: 2.8,
    ageRange: '3-8岁',
    images: [
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '陈老师',
    coachIntro: '亲子课程专项教练，关注亲子互动与孩子动作启蒙。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61',
      'https://dummyimage.com/240x160/f6f7fb/1677ff.png&text=%E8%AF%81%E4%B9%A62'
    ]
  },
  {
    id: 'course-103',
    cover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    title: '3-6岁趣味平衡课',
    startTime: '2026-03-24T18:30:00+08:00',
    endTime: '2026-03-24T19:30:00+08:00',
    location: '北京市 朝阳区 · 嘉美风尚社区广场',
    groupPrice: 8800,
    originalPrice: 13800,
    joinedCount: 1,
    targetCount: 4,
    distanceKm: 0.9,
    ageRange: '3-6岁',
    images: [
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '李教练',
    coachIntro: '专注低龄儿童动作启蒙，课程节奏轻松、互动强。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-104',
    cover: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    title: '跳跃爆发力提升课',
    startTime: '2026-03-30T19:00:00+08:00',
    endTime: '2026-03-30T20:00:00+08:00',
    location: '北京市 丰台区 · 丽泽社区运动场',
    groupPrice: 11800,
    originalPrice: 16800,
    joinedCount: 2,
    targetCount: 6,
    distanceKm: 6.3,
    ageRange: '6-10岁',
    images: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '赵老师',
    coachIntro: '擅长爆发力和弹跳训练，注重动作规范与安全保护。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-105',
    cover: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80',
    title: '少儿敏捷跑动训练',
    startTime: '2026-03-23T17:20:00+08:00',
    endTime: '2026-03-23T18:20:00+08:00',
    location: '北京市 朝阳区 · 太阳宫体育角',
    groupPrice: 9200,
    originalPrice: 14800,
    joinedCount: 4,
    targetCount: 6,
    distanceKm: 3.4,
    ageRange: '5-9岁',
    images: [
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '周教练',
    coachIntro: '强调跑动敏捷与反应训练，适合好动型孩子。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-106',
    cover: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=800&q=80',
    title: '儿童核心力量启蒙课',
    startTime: '2026-03-25T10:30:00+08:00',
    endTime: '2026-03-25T11:30:00+08:00',
    location: '北京市 西城区 · 德胜门社区活动区',
    groupPrice: 10500,
    originalPrice: 15800,
    joinedCount: 2,
    targetCount: 4,
    distanceKm: 5.1,
    ageRange: '4-8岁',
    images: [
      'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '孙老师',
    coachIntro: '核心力量与身体控制教学经验丰富，训练节奏适中。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-107',
    cover: 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=800&q=80',
    title: '亲子户外接力体验课',
    startTime: '2026-03-27T16:00:00+08:00',
    endTime: '2026-03-27T17:00:00+08:00',
    location: '北京市 东城区 · 龙潭湖公园北门',
    groupPrice: 13200,
    originalPrice: 19800,
    joinedCount: 3,
    targetCount: 4,
    distanceKm: 7.8,
    ageRange: '4-9岁',
    images: [
      'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '许老师',
    coachIntro: '亲子互动课程设计师，擅长营造轻松愉快的课堂氛围。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-108',
    cover: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80',
    title: '少儿协调与反应力课',
    startTime: '2026-03-22T19:10:00+08:00',
    endTime: '2026-03-22T20:00:00+08:00',
    location: '北京市 海淀区 · 清河小区篮球场',
    groupPrice: 8600,
    originalPrice: 13600,
    joinedCount: 1,
    targetCount: 5,
    distanceKm: 8.2,
    ageRange: '5-10岁',
    images: [
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '吴教练',
    coachIntro: '重视反应速度、协调控制和团队互动训练。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-109',
    cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
    title: '周中晚间趣味体适能',
    startTime: '2026-03-31T18:40:00+08:00',
    endTime: '2026-03-31T19:40:00+08:00',
    location: '北京市 朝阳区 · 青年汇小区花园',
    groupPrice: 9600,
    originalPrice: 14600,
    joinedCount: 5,
    targetCount: 6,
    distanceKm: 2.1,
    ageRange: '4-8岁',
    images: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '郑老师',
    coachIntro: '晚间课程经验丰富，注重课程节奏和家长沟通。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-110',
    cover: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80',
    title: '周六晨练体能挑战课',
    startTime: '2026-04-02T09:00:00+08:00',
    endTime: '2026-04-02T10:00:00+08:00',
    location: '北京市 通州区 · 运河公园中心区',
    groupPrice: 11200,
    originalPrice: 17200,
    joinedCount: 2,
    targetCount: 5,
    distanceKm: 12.6,
    ageRange: '6-10岁',
    images: [
      'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '何教练',
    coachIntro: '晨练课程专长，擅长综合体能唤醒与节奏训练。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-111',
    cover: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=800&q=80',
    title: '儿童耐力跑入门营',
    startTime: '2026-03-29T08:30:00+08:00',
    endTime: '2026-03-29T09:30:00+08:00',
    location: '北京市 石景山区 · 八角社区绿地',
    groupPrice: 9800,
    originalPrice: 15200,
    joinedCount: 4,
    targetCount: 6,
    distanceKm: 10.8,
    ageRange: '6-12岁',
    images: [
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '彭老师',
    coachIntro: '专注耐力训练和心肺能力提升，课程安排循序渐进。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  },
  {
    id: 'course-112',
    cover: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=800&q=80',
    title: '周末儿童运动游戏课',
    startTime: '2026-03-24T09:30:00+08:00',
    endTime: '2026-03-24T10:30:00+08:00',
    location: '北京市 大兴区 · 兴华公园草坪',
    groupPrice: 8900,
    originalPrice: 13900,
    joinedCount: 2,
    targetCount: 4,
    distanceKm: 13.7,
    ageRange: '3-7岁',
    images: [
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=800&q=80'
    ],
    coachName: '高老师',
    coachIntro: '擅长把运动训练设计成闯关游戏，提升孩子参与意愿。',
    coachCertificates: [
      'https://dummyimage.com/240x160/e8f3ff/1677ff.png&text=%E8%AF%81%E4%B9%A61'
    ]
  }
]

const GROUP_DETAIL_MAP = {
  'group-101': {
    groupId: 'group-101',
    courseId: 'course-101',
    status: 'ongoing',
    currentCount: 3,
    targetCount: 5,
    remainingSeconds: 18 * 3600 + 20 * 60,
    refundDesc: '截止时间未成团将自动原路退款',
    userJoined: true,
    members: [
      { avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=A', nickName: '安安妈' },
      { avatar: 'https://dummyimage.com/96x96/fbead9/ff7a00.png&text=B', nickName: '贝贝爸' },
      { avatar: 'https://dummyimage.com/96x96/e7f8ef/1f9d63.png&text=C', nickName: '晨晨妈' }
    ]
  },
  'group-102': {
    groupId: 'group-102',
    courseId: 'course-102',
    status: 'ongoing',
    currentCount: 4,
    targetCount: 5,
    remainingSeconds: 8 * 3600 + 35 * 60,
    refundDesc: '截止时间未成团将自动原路退款',
    userJoined: false,
    members: [
      { avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=1', nickName: '一一妈' },
      { avatar: 'https://dummyimage.com/96x96/fbead9/ff7a00.png&text=2', nickName: '朵朵爸' },
      { avatar: 'https://dummyimage.com/96x96/e7f8ef/1f9d63.png&text=3', nickName: '可可妈' },
      { avatar: 'https://dummyimage.com/96x96/f4ecff/7a5cff.png&text=4', nickName: '乐乐爸' }
    ]
  },
  'group-109': {
    groupId: 'group-109',
    courseId: 'course-109',
    status: 'ongoing',
    currentCount: 5,
    targetCount: 6,
    remainingSeconds: 4 * 3600 + 10 * 60,
    refundDesc: '截止时间未成团将自动原路退款',
    userJoined: true,
    members: [
      { avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=M1', nickName: '米米妈' },
      { avatar: 'https://dummyimage.com/96x96/fbead9/ff7a00.png&text=M2', nickName: '元元爸' },
      { avatar: 'https://dummyimage.com/96x96/e7f8ef/1f9d63.png&text=M3', nickName: '九九妈' },
      { avatar: 'https://dummyimage.com/96x96/f4ecff/7a5cff.png&text=M4', nickName: '宁宁爸' },
      { avatar: 'https://dummyimage.com/96x96/fff4d8/c79200.png&text=M5', nickName: '小满妈' }
    ]
  },
  'group-201': {
    groupId: 'group-201',
    courseId: 'course-103',
    status: 'success',
    currentCount: 4,
    targetCount: 4,
    remainingSeconds: 0,
    refundDesc: '已成团，不支持自动退款',
    userJoined: true,
    members: [
      { avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=S1', nickName: '果果妈' },
      { avatar: 'https://dummyimage.com/96x96/fbead9/ff7a00.png&text=S2', nickName: '西西爸' },
      { avatar: 'https://dummyimage.com/96x96/e7f8ef/1f9d63.png&text=S3', nickName: '点点妈' },
      { avatar: 'https://dummyimage.com/96x96/f4ecff/7a5cff.png&text=S4', nickName: '阿杰爸' }
    ]
  },
  'group-301': {
    groupId: 'group-301',
    courseId: 'course-104',
    status: 'failed',
    currentCount: 2,
    targetCount: 6,
    remainingSeconds: 0,
    refundDesc: '拼团失败，系统已自动原路退款',
    userJoined: false,
    members: [
      { avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=F1', nickName: '悠悠妈' },
      { avatar: 'https://dummyimage.com/96x96/fbead9/ff7a00.png&text=F2', nickName: '大壮爸' }
    ]
  }
}

const ACTIVE_GROUP_MAP = Object.keys(GROUP_DETAIL_MAP).reduce((result, groupId) => {
  const item = GROUP_DETAIL_MAP[groupId]
  if (item.status === 'ongoing') {
    result[item.courseId] = item
  }
  return result
}, {})

const MOCK_PAYMENT_PARAMS = {
  timeStamp: `${Math.floor(Date.now() / 1000)}`,
  nonceStr: 'mockNonceStr123456',
  package: 'prepay_id=mock_prepay_id',
  signType: 'MD5',
  paySign: 'MOCK_PAY_SIGN'
}

const USER_GROUP_STATUS_MAP = {
  all: '',
  ongoing: 'ongoing',
  success: 'success',
  failed: 'failed'
}

module.exports = {
  SERVICE_QR_CODE,
  buildDescriptionNodes,
  GROUP_RULE_NODES,
  PAYMENT_GROUP_NOTE_NODES,
  MOCK_COURSES,
  GROUP_DETAIL_MAP,
  ACTIVE_GROUP_MAP,
  MOCK_PAYMENT_PARAMS,
  USER_GROUP_STATUS_MAP
}
