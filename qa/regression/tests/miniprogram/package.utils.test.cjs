const test = require('node:test')
const assert = require('node:assert/strict')

const {
  calculatePackageMemberAmountFen,
  formatPackageLocationText,
  normalizePackageDetail,
  normalizePackageGroupDetail
} = require('../../../../miniprogram/utils/package')

test('miniprogram package utils: location text uses city, district, and community only', () => {
  const locationText = formatPackageLocationText({
    location_province: '广东省',
    location_city: '深圳市',
    location_district: '广东省 / 深圳市 / 南山区',
    location_community: '深圳湾社区',
    location_detail: '深圳湾社区 会所二楼活动室'
  })

  assert.equal(locationText, '深圳市 / 南山区 / 深圳湾社区')
})

test('miniprogram package utils: configured group price takes precedence over total price average', () => {
  const amountFen = calculatePackageMemberAmountFen({
    totalPriceFen: 120000,
    targetCount: 4,
    groupPriceConfig: [{ target_count: 4, price_fen: 47200 }]
  })

  assert.equal(amountFen, 47200)
})

test('miniprogram package utils: package detail normalization exposes active groups and price display', () => {
  const detail = normalizePackageDetail({
    id: 'package_seed_active_002',
    name: '[测试] 深圳宝安体能进阶·等待上课',
    cover: 'https://example.com/cover.png',
    images: ['https://example.com/cover.png'],
    total_price_fen: 198000,
    group_price_config: [{ target_count: 4, price_fen: 49500 }],
    supported_people: [4],
    class_count: 5,
    class_duration_minutes: 90,
    location_city: '深圳市',
    location_district: '南山区',
    location_community: '科技园社区',
    location_detail: '二楼体能室',
    coach_name: '回归教练',
    coach_intro: '介绍文案',
    coach_certificates: ['https://example.com/cert.png'],
    description: '课程说明',
    active_groups: [
      {
        id: 'pkg-group-1',
        target_count: 4,
        current_count: 2,
        status: 'active',
        remaining_seconds: 7200,
        member_amount_fen: 49500,
        schedule_text: '每周六 10:00，共5次'
      },
      {
        id: 'pkg-group-expired',
        target_count: 4,
        current_count: 4,
        status: 'active',
        remaining_seconds: 0,
        member_amount_fen: 49500,
        schedule_text: '每周日 10:00，共5次'
      }
    ]
  })

  assert.equal(detail.totalPriceDisplayText, '1980')
  assert.equal(detail.supportedGroupPriceList[0].memberAmountDisplayText, '495')
  assert.equal(detail.activeGroups.length, 1)
  assert.equal(detail.activeGroups[0].joinButtonText, '还缺2人，立即拼')
  assert.equal(detail.locationText, '深圳市 / 南山区 / 科技园社区')
})

test('miniprogram package utils: group detail normalization keeps schedule and member presentation', () => {
  const detail = normalizePackageGroupDetail({
    id: '21111111-1111-1111-1111-111111111202',
    status: 'success',
    package: {
      id: '11111111-1111-1111-1111-111111111103',
      name: '[测试] 深圳宝安体能进阶·等待上课',
      location_city: '深圳市',
      location_district: '宝安区',
      location_community: '壹方城',
      location_detail: 'L2 训练区'
    },
    target_count: 4,
    current_count: 4,
    member_amount_fen: 49500,
    schedule_text: '每周六 10:00，共5次，成团后锁定首课日期',
    first_class_time: '2026-05-01 10:00:00',
    schedule_list: [{ class_time: '2026-05-01 10:00:00' }],
    members: [{ nickname: '测试家长02', child_nickname: '小满', child_age: 10, avatar_url: '' }],
    user_joined: true
  })

  assert.equal(detail.packageInfo.locationText, '深圳市 / 宝安区 / 壹方城')
  assert.equal(detail.scheduleDisplayText, '每周六 10:00 共5节课')
  assert.equal(detail.progressPercent, '100%')
  assert.equal(detail.members[0].avatar_url, '/assets/member-default-avatar.jpg')
  assert.equal(detail.members[0].displayName, '小满')
  assert.equal(detail.members[0].displayText, '小满   10岁')
  assert.match(detail.firstClassTimeText, /05月01日/)
})
