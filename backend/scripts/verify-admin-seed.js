require('dotenv').config()

const supabase = require('../utils/supabase')
const { COURSE_STATUS, getCourseLifecycleMap } = require('../utils/courseLifecycle')
const { AUTO_REFUND_REASON } = require('../shared/constants/refunds')

const EXPECTED_COURSES = {
  '[测试] 深圳南山周末体适能·待上架': COURSE_STATUS.PENDING_PUBLISH,
  '[测试] 深圳福田少儿体适能·拼团中': COURSE_STATUS.GROUPING,
  '[测试] 深圳宝安体能进阶·等待上课': COURSE_STATUS.WAITING_CLASS,
  '[测试] 深圳龙华平衡训练·拼团失败': COURSE_STATUS.GROUP_FAILED,
  '[测试] 深圳罗湖爆发力训练·已结课': COURSE_STATUS.FINISHED
}

const STATUS_TEXT = {
  [COURSE_STATUS.PENDING_PUBLISH]: '待上架',
  [COURSE_STATUS.GROUPING]: '拼团中',
  [COURSE_STATUS.GROUP_FAILED]: '拼团失败',
  [COURSE_STATUS.WAITING_CLASS]: '等待上课',
  [COURSE_STATUS.IN_CLASS]: '上课中',
  [COURSE_STATUS.FINISHED]: '已结课',
  [COURSE_STATUS.UNPUBLISHED]: '已下架'
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const failures = []
  const recordFailure = message => {
    failures.push(message)
  }
  const expect = (condition, message) => {
    if (!condition) {
      recordFailure(message)
    }
  }

  const expectedTitles = Object.keys(EXPECTED_COURSES)
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('id, name')
    .in('name', expectedTitles)

  if (courseError) {
    throw courseError
  }

  assert((courses || []).length === expectedTitles.length, '测试课程数量不完整，请先导入完整测试数据')

  const coursesByTitle = (courses || []).reduce((result, item) => {
    result[item.name] = item
    return result
  }, {})

  const lifecycleMap = await getCourseLifecycleMap(
    (courses || []).map(item => item.id),
    { operatorId: null }
  )

  for (const title of expectedTitles) {
    const course = coursesByTitle[title]
    const lifecycle = lifecycleMap[course.id]
    assert(!!course, `缺少课程：${title}`)
    expect(
      lifecycle && lifecycle.status === EXPECTED_COURSES[title],
      `${title} 状态错误，expected=${STATUS_TEXT[EXPECTED_COURSES[title]]} actual=${STATUS_TEXT[lifecycle && lifecycle.status]}`
    )
  }

  const targetCourseIds = (courses || []).map(item => item.id)
  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('id, course_id, status, current_count, target_count')
    .in('course_id', targetCourseIds)

  if (groupError) {
    throw groupError
  }

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, course_id, group_id, status, refund_reason')
    .in('course_id', targetCourseIds)

  if (orderError) {
    throw orderError
  }

  const { data: members, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, user_id')
    .in('group_id', (groups || []).map(item => item.id))

  if (memberError) {
    throw memberError
  }

  const byCourseTitle = title => {
    const course = coursesByTitle[title]
    return {
      course,
      groups: (groups || []).filter(item => item.course_id === course.id),
      orders: (orders || []).filter(item => item.course_id === course.id)
    }
  }

  const pendingCourse = byCourseTitle('[测试] 深圳南山周末体适能·待上架')
  expect(pendingCourse.groups.length === 0, '待上架课程不应存在拼团记录')
  expect(pendingCourse.orders.length === 0, '待上架课程不应存在订单记录')

  const groupingCourse = byCourseTitle('[测试] 深圳福田少儿体适能·拼团中')
  expect(groupingCourse.groups.length === 1, '拼团中课程应存在 1 个进行中的团')
  expect(groupingCourse.groups[0] && groupingCourse.groups[0].status === 'active', '拼团中课程的团状态应为 active')
  expect(groupingCourse.orders.filter(item => item.status === 'success').length === 2, '拼团中课程应有 2 个成功订单')
  expect(groupingCourse.orders.filter(item => item.status === 'pending').length === 1, '拼团中课程应有 1 个待支付订单')

  const waitingCourse = byCourseTitle('[测试] 深圳宝安体能进阶·等待上课')
  expect(waitingCourse.groups.length === 1, '等待上课课程应存在 1 个成功团')
  expect(waitingCourse.groups[0] && waitingCourse.groups[0].status === 'success', '等待上课课程的团状态应为 success')
  expect(waitingCourse.orders.filter(item => item.status === 'success').length === 3, '等待上课课程应有 3 个成功订单')

  const failedCourse = byCourseTitle('[测试] 深圳龙华平衡训练·拼团失败')
  expect(failedCourse.groups.length === 1, '拼团失败课程应存在 1 个失败团')
  expect(failedCourse.groups[0] && failedCourse.groups[0].status === 'failed', '拼团失败课程的团状态应为 failed')
  expect(failedCourse.orders.every(item => item.status === 'refunded'), '拼团失败课程的订单应全部为 refunded')
  expect(
    failedCourse.orders.every(item => item.refund_reason === AUTO_REFUND_REASON),
    '拼团失败课程的退款原因应为系统自动退款口径'
  )
  expect(
    failedCourse.groups[0] && (members || []).filter(item => item.group_id === failedCourse.groups[0].id).length === 2,
    '拼团失败课程应保留 2 条 group_members 记录'
  )

  const finishedCourse = byCourseTitle('[测试] 深圳罗湖爆发力训练·已结课')
  expect(finishedCourse.groups.length === 1, '已结课课程应存在 1 个成功团')
  expect(finishedCourse.groups[0] && finishedCourse.groups[0].status === 'success', '已结课课程的团状态应为 success')
  expect(finishedCourse.orders.filter(item => item.status === 'success').length === 4, '已结课课程应有 4 个成功订单')

  if (failures.length > 0) {
    throw new Error(
      [
        '当前测试库已偏离 0326 seed 基线',
        ...failures.map((message, index) => `${index + 1}. ${message}`),
        '如需恢复这条校验，请重新导入 docs/sql/reset_test_seed_0326.sql'
      ].join('\n')
    )
  }

  console.log('PASS verify-admin-seed: 测试课程、拼团、订单、退款数据校验通过')
}

main().catch(error => {
  console.error(`FAIL verify-admin-seed: ${error.message || String(error)}`)
  process.exit(1)
})
