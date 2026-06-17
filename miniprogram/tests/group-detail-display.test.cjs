const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { formatPackageGroupScheduleList, normalizePackageGroupDetail } = require('../utils/package')

const groupDetailJsPath = path.resolve(__dirname, '..', 'pages/group/detail/index.js')
const groupDetailWxmlPath = path.resolve(__dirname, '..', 'pages/group/detail/index.wxml')
const courseOverviewComponentWxmlPath = path.resolve(__dirname, '..', 'components/course-overview-sections/index.wxml')

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
  assert.match(groupDetailJsSource, /value:\s*`\$\{groupDetail\.targetCount\}人团，每人 ¥\$\{groupDetail\.memberAmountDisplayText \|\| groupDetail\.memberAmountText\}`/)
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
  assert.deepEqual(detail.packageInfo.featureTags, ['包含5节课', '上课时间家长定'])
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
