const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  buildPackageGroupShareTitle,
  formatPackageGroupScheduleList,
  normalizePackageDetail,
  normalizePackageGroupDetail,
  normalizeUserPackageGroupListItem,
  resolvePackageGroupProgressCopy
} = require('../utils/package')

const groupDetailJsPath = path.resolve(__dirname, '..', 'pages/group/detail/index.js')
const groupDetailWxmlPath = path.resolve(__dirname, '..', 'pages/group/detail/index.wxml')
const courseDetailWxmlPath = path.resolve(__dirname, '..', 'pages/course/detail/index.wxml')
const courseOverviewComponentWxmlPath = path.resolve(__dirname, '..', 'components/course-overview-sections/index.wxml')
const paymentConfirmJsPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.js')

test('group detail keeps schedule and member sections above insurance banner', () => {
  const wxmlSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')
  const overviewSource = fs.readFileSync(courseOverviewComponentWxmlPath, 'utf8')

  assert.match(overviewSource, /showInsuranceBanner/)
  assert.match(wxmlSource, /showInsuranceBanner="{{false}}"/)
  assert.match(wxmlSource, /showSupportedGroupPrices="{{false}}"/)
  assert.match(wxmlSource, /showCourseContentSections="{{false}}"/)
  assert.match(wxmlSource, /<insurance-banner/)

  const memberSectionIndex = wxmlSource.indexOf('section-title">成员列表')
  const scheduleSectionIndex = wxmlSource.indexOf('section-title">课时安排')
  const insuranceIndex = wxmlSource.indexOf('<insurance-banner')
  const introIndex = wxmlSource.indexOf('showCourseInfoCard="{{false}}"')

  assert.ok(memberSectionIndex > -1, 'members section should exist')
  assert.ok(scheduleSectionIndex > -1, 'schedule section should exist')
  assert.ok(insuranceIndex > -1, 'insurance banner should exist on group detail')
  assert.ok(introIndex > -1, 'course intro sections should still render after group sections')
  assert.ok(memberSectionIndex < introIndex, 'members section should render before course intro sections')
  assert.ok(scheduleSectionIndex < introIndex, 'schedule section should render before course intro sections')
  assert.ok(memberSectionIndex < insuranceIndex, 'members section should render before insurance banner')
  assert.ok(scheduleSectionIndex < insuranceIndex, 'schedule section should render before insurance banner')
  assert.match(wxmlSource, /wx:if="{{groupDetail\.scheduleList\.length}}"/)
  assert.doesNotMatch(wxmlSource, /次课时安排|单次课程安排/)
})

test('group detail removes empty package group schedule info row', () => {
  const jsSource = fs.readFileSync(groupDetailJsPath, 'utf8')

  assert.doesNotMatch(jsSource, /label:\s*'拼团课时'/)
})

test('group detail uses its own overview card layout variant', () => {
  const groupDetailWxmlSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')
  const overviewSource = fs.readFileSync(courseOverviewComponentWxmlPath, 'utf8')
  const groupDetailJsSource = fs.readFileSync(groupDetailJsPath, 'utf8')

  assert.match(groupDetailWxmlSource, /detailLayoutVariant="{{'group-detail'}}"/)
  assert.match(groupDetailWxmlSource, /showFeatureTags="{{false}}"/)
  assert.match(overviewSource, /shared-group-detail-info-grid/)
  assert.match(overviewSource, /shared-group-detail-countdown/)
  assert.match(groupDetailJsSource, /label:\s*'拼团类型'/)
  assert.match(groupDetailJsSource, /groupDetail\.minSuccessCount.*groupDetail\.targetCount/)
  assert.match(groupDetailJsSource, /每人 ¥\$\{groupDetail\.memberAmountDisplayText \|\| groupDetail\.memberAmountText\}/)
})

test('group detail formats schedule rows without a gap between weekday and time', () => {
  const detail = normalizePackageGroupDetail({
    id: 'PG-20260616-00005',
    status: 'active',
    target_count: 6,
    current_count: 1,
    member_amount_fen: 60,
    remaining_seconds: 166463,
    schedule_list: [
      { index: 1, display_text: '2026-06-19 09:00:00' },
      { index: 2, display_text: '2026-06-20 周六09:00 - 10:30' }
    ],
    package: {
      id: 'PKG-20260531-0004',
      name: '青少年体适能（测试环境）',
      class_duration_minutes: 90
    }
  })

  assert.equal(detail.scheduleList[0].display_text, '2026-06-19 周五09:00 - 10:30')
  assert.equal(detail.scheduleList[1].display_text, '2026-06-20 周六09:00 - 10:30')
})

test('group detail can reformat fetched schedule rows after package duration is enriched', () => {
  const scheduleList = formatPackageGroupScheduleList(
    [
      { index: 1, display_text: '2026-06-19 09:00:00' },
      { index: 2, display_text: '2026-06-20 09:00:00' },
      { index: 3, display_text: '2026-06-22 周一13:30' },
      { index: 4, display_text: '2026-06-24 周三 13:30' }
    ],
    90
  )
  const jsSource = fs.readFileSync(groupDetailJsPath, 'utf8')

  assert.equal(scheduleList[0].display_text, '2026-06-19 周五09:00 - 10:30')
  assert.equal(scheduleList[1].display_text, '2026-06-20 周六09:00 - 10:30')
  assert.equal(scheduleList[2].display_text, '2026-06-22 周一13:30 - 15:00')
  assert.equal(scheduleList[3].display_text, '2026-06-24 周三13:30 - 15:00')
  assert.match(jsSource, /formatPackageGroupScheduleList/)
})

test('course overview package prices render configured group type labels', () => {
  const overviewSource = fs.readFileSync(courseOverviewComponentWxmlPath, 'utf8')

  assert.match(overviewSource, /item\.label/)
  assert.doesNotMatch(overviewSource, /\{\{item\.count\}\}人团/)
})

test('package group type labels use 1-to-1 private coaching copy', () => {
  const groupDetailJsSource = fs.readFileSync(groupDetailJsPath, 'utf8')
  const paymentConfirmJsSource = fs.readFileSync(paymentConfirmJsPath, 'utf8')
  const detail = normalizePackageDetail({
    id: 'PKG-20260629-0011',
    total_price_fen: 110000,
    supported_people: [1, 2],
    group_price_config: [
      { min_success_count: 1, target_count: 1, price_fen: 110000 },
      { min_success_count: 2, target_count: 2, price_fen: 66000 }
    ]
  })

  assert.equal(detail.supportedGroupPriceList[0].label, '1对1私教')
  assert.match(groupDetailJsSource, /1对1私教/)
  assert.match(paymentConfirmJsSource, /1对1私教/)
  assert.doesNotMatch(groupDetailJsSource, /1人私教/)
  assert.doesNotMatch(paymentConfirmJsSource, /1人私教/)
})

test('group detail overview renders one location row and no schedule time row', () => {
  const groupDetailWxmlSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')
  const overviewSource = fs.readFileSync(courseOverviewComponentWxmlPath, 'utf8')
  const groupDetailJsSource = fs.readFileSync(groupDetailJsPath, 'utf8')

  assert.match(groupDetailWxmlSource, /showLocationInfo="{{false}}"/)
  assert.match(overviewSource, /wx:for="{{extraInfoRows}}"/)
  assert.doesNotMatch(overviewSource, /extraInfoRows\[0\]\.label/)
  assert.match(groupDetailJsSource, /label:\s*'上课地点'/)
  assert.doesNotMatch(groupDetailJsSource, /label:\s*'上课时间'/)
  assert.doesNotMatch(groupDetailJsSource, /groupDetail\.scheduleDisplayText/)
})

test('package active group progress copy uses minimum success count for range groups', () => {
  const detail = normalizePackageDetail({
    id: 'PKG-20260629-0011',
    total_price_fen: 120000,
    supported_people: [2, 4],
    group_price_config: [
      { min_success_count: 1, target_count: 2, price_fen: 60000 },
      { min_success_count: 3, target_count: 4, price_fen: 30000 }
    ],
    active_groups: [
      {
        id: 'PG-20260630-0000',
        min_success_count: 1,
        target_count: 2,
        current_count: 1,
        remaining_seconds: 600,
        member_amount_fen: 60000
      },
      {
        id: 'PG-20260630-0001',
        min_success_count: 3,
        target_count: 4,
        current_count: 2,
        remaining_seconds: 600,
        member_amount_fen: 30000
      },
      {
        id: 'PG-20260630-0002',
        min_success_count: 3,
        target_count: 4,
        current_count: 3,
        remaining_seconds: 600,
        member_amount_fen: 30000
      }
    ]
  })
  const courseDetailWxmlSource = fs.readFileSync(courseDetailWxmlPath, 'utf8')

  assert.equal(detail.activeGroups[0].groupTypeLabel, '1～2人团')
  assert.equal(detail.activeGroups[0].joinButtonText, '可加1人')
  assert.equal(detail.activeGroups[1].groupTypeLabel, '3～4人团')
  assert.equal(detail.activeGroups[1].missingCount, 1)
  assert.equal(detail.activeGroups[1].joinButtonText, '还缺1人，立即拼')
  assert.equal(detail.activeGroups[2].groupTypeLabel, '3～4人团')
  assert.equal(detail.activeGroups[2].missingCount, 0)
  assert.equal(detail.activeGroups[2].joinButtonText, '可加1人')
  assert.match(courseDetailWxmlSource, /item\.groupTypeLabel/)
  assert.doesNotMatch(courseDetailWxmlSource, /item\.targetCount\}\}人成团/)
  assert.deepEqual(resolvePackageGroupProgressCopy({
    minSuccessCount: 3,
    targetCount: 4,
    currentCount: 3
  }), {
    missingCount: 0,
    extraSeatCount: 1,
    reachedMinSuccess: true,
    missingText: '可加1人',
    sharePrefix: '可加1人'
  })
  assert.equal(
    buildPackageGroupShareTitle({
      minSuccessCount: 3,
      targetCount: 4,
      currentCount: 3,
      packageName: '青少年体适能'
    }),
    '可加1人，来拼「青少年体适能」'
  )
})

test('user package group list shows addable copy for active range groups that reached minimum count', () => {
  const item = normalizeUserPackageGroupListItem({
    order_id: 'order-1',
    package_group_id: 'PG-20260630-0003',
    package_name: '青少年体适能',
    status: 'active',
    group_status: 'active',
    min_success_count: 1,
    target_count: 2,
    current_count: 1
  })

  assert.equal(item.status, 'active')
  assert.equal(item.displayStatusText, '可加1人')
  assert.equal(item.missingCount, 0)
})

test('package start and payment rule copy explains full group or deadline minimum success', () => {
  const packageStartWxmlPath = path.resolve(__dirname, '..', 'pages/package/start/index.wxml')
  const paymentConfirmWxmlPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.wxml')
  const groupDetailWxmlSource = fs.readFileSync(groupDetailWxmlPath, 'utf8')
  const packageStartWxmlSource = fs.readFileSync(packageStartWxmlPath, 'utf8')
  const paymentConfirmWxmlSource = fs.readFileSync(paymentConfirmWxmlPath, 'utf8')

  assert.match(packageStartWxmlSource, /满员或到截止时间达到最低成团人数都可成团/)
  assert.match(paymentConfirmWxmlSource, /满员或到截止时间达到最低成团人数都可成团/)
  assert.match(groupDetailWxmlSource, /满员或到截止时间达到最低成团人数都可成团/)
  assert.doesNotMatch(packageStartWxmlSource, /满员立即成团；区间团到截止时间达到最低成团人数也可成团/)
})

test('group detail does not invent a 60 minute duration tag when API omits duration', () => {
  const detail = normalizePackageGroupDetail({
    id: 'PG-20260616-00003',
    status: 'active',
    target_count: 6,
    current_count: 1,
    member_amount_fen: 60,
    remaining_seconds: 166463,
    schedule_mode: 'locked',
    first_class_time: null,
    schedule_list: [
      { index: 1, display_text: '2026-06-19 周五09:00 - 10:30' },
      { index: 2, display_text: '2026-06-20 周六09:00 - 10:30' },
      { index: 3, display_text: '2026-06-21 周日09:00 - 10:30' },
      { index: 4, display_text: '2026-06-22 周一09:00 - 10:30' },
      { index: 5, display_text: '2026-06-23 周二09:00 - 10:30' }
    ],
    package: {
      id: 'PKG-20260531-0004',
      name: '青少年体适能（测试环境）',
      age_range: '12-16岁'
    }
  })

  assert.equal(detail.packageInfo.classCount, 5)
  assert.deepEqual(detail.packageInfo.featureTags, ['包含5节课', '上课时间自己定'])
})

test('group detail uses provided class duration in feature tag', () => {
  const detail = normalizePackageGroupDetail({
    id: 'PG-20260616-00004',
    status: 'active',
    target_count: 6,
    current_count: 1,
    member_amount_fen: 60,
    remaining_seconds: 166463,
    schedule_list: [],
    package: {
      id: 'PKG-20260531-0004',
      name: '青少年体适能（测试环境）',
      class_count: 5,
      class_duration_minutes: 90
    }
  })

  assert.match(detail.packageInfo.featureTags.join('|'), /课时长90分钟/)
})
