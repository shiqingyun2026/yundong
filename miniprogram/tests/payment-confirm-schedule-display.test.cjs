const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const paymentConfirmWxmlPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.wxml')
const paymentConfirmJsPath = path.resolve(__dirname, '..', 'pages/payment/confirm/index.js')
const packageUtilsPath = path.resolve(__dirname, '..', 'utils/package.js')
const { normalizePackageGroupDetail } = require(packageUtilsPath)

test('join payment page shows class arrangement and compact multi-class schedule summary', () => {
  const wxmlSource = fs.readFileSync(paymentConfirmWxmlPath, 'utf8')
  const jsSource = fs.readFileSync(paymentConfirmJsPath, 'utf8')

  assert.match(wxmlSource, /<view class="section-title">课时安排<\/view>/)
  assert.match(wxmlSource, /schedule-preview-list/)
  assert.match(wxmlSource, /paymentScheduleList\.length > 1/)
  assert.match(wxmlSource, /\{\{item\.displayText\}\}/)
  assert.match(jsSource, /hasScheduleList\s*=\s*Array\.isArray\(detail\.scheduleList\) && detail\.scheduleList\.length > 0/)
  assert.match(jsSource, /hasScheduleList \? detail\.scheduleList\.length : 0/)
  assert.match(jsSource, /classCount > 1 && hasScheduleList/)
  assert.match(jsSource, /formatPaymentScheduleDisplayText/)
  assert.match(jsSource, /addMinutesToTimeText/)
  assert.match(jsSource, /详见课表/)
  assert.doesNotMatch(wxmlSource, /系统会在成团后/)
  assert.doesNotMatch(
    wxmlSource,
    /<view class="notice-item">\s*<view class="notice-dot"><\/view>\s*<\/view>/
  )
})

test('package group normalize tolerates locked mode without first class time from old backend', () => {
  const packageUtilsSource = fs.readFileSync(packageUtilsPath, 'utf8')
  const detail = normalizePackageGroupDetail({
    id: 'PG-20260616-00003',
    status: 'active',
    target_count: 6,
    current_count: 1,
    schedule_mode: 'locked',
    first_class_time: null,
    schedule_text: '首课时间 ，共5次',
    schedule_list: [
      { index: 1, display_text: '2026-06-19 周五09:00 - 10:30' },
      { index: 2, display_text: '2026-06-20 周六09:00 - 10:30' },
      { index: 3, display_text: '2026-06-21 周日09:00 - 10:30' },
      { index: 4, display_text: '2026-06-22 周一09:00 - 10:30' },
      { index: 5, display_text: '2026-06-23 周二09:00 - 10:30' }
    ],
    package: {
      id: 'PKG-20260531-0004',
      name: '青少年体适能（测试环境）'
    }
  })

  assert.equal(detail.packageInfo.classCount, 5)
  assert.equal(detail.scheduleMode, 'pending')
  assert.equal(detail.scheduleText, '')
  assert.match(packageUtilsSource, /rawScheduleMode === 'locked' && !hasFirstClassTime \? 'pending' : rawScheduleMode/)
  assert.match(packageUtilsSource, /\^首课时间\\s\*，/)
})
