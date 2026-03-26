const { COURSE_STATUS, computeCourseLifecycleStatus } = require('../utils/courseLifecycle')

const STATUS_TEXT = {
  [COURSE_STATUS.PENDING_PUBLISH]: '待上架',
  [COURSE_STATUS.GROUPING]: '拼团中',
  [COURSE_STATUS.GROUP_FAILED]: '拼团失败',
  [COURSE_STATUS.WAITING_CLASS]: '等待上课',
  [COURSE_STATUS.IN_CLASS]: '上课中',
  [COURSE_STATUS.FINISHED]: '已结课',
  [COURSE_STATUS.UNPUBLISHED]: '已下架'
}

const assertScenario = ({ name, course, stats, now, expectedStatus }) => {
  const actualStatus = computeCourseLifecycleStatus(course, stats, now)
  const passed = actualStatus === expectedStatus

  return {
    name,
    passed,
    expectedStatus,
    actualStatus
  }
}

const baseCourse = {
  publish_time: '2026-03-26T10:00:00+08:00',
  deadline: '2026-03-28T18:00:00+08:00',
  start_time: '2026-03-29T10:00:00+08:00',
  end_time: '2026-03-29T12:00:00+08:00',
  unpublish_time: null
}

const scenarios = [
  {
    name: '报名截止前无成功团时保持拼团中',
    course: baseCourse,
    stats: { successGroupCount: 0 },
    now: new Date('2026-03-27T12:00:00+08:00'),
    expectedStatus: COURSE_STATUS.GROUPING
  },
  {
    name: '报名截止前至少一个团成功时进入等待上课',
    course: baseCourse,
    stats: { successGroupCount: 1 },
    now: new Date('2026-03-28T12:00:00+08:00'),
    expectedStatus: COURSE_STATUS.WAITING_CLASS
  },
  {
    name: '到开课时间后进入上课中',
    course: baseCourse,
    stats: { successGroupCount: 1 },
    now: new Date('2026-03-29T10:30:00+08:00'),
    expectedStatus: COURSE_STATUS.IN_CLASS
  },
  {
    name: '到结束时间后进入已结课',
    course: baseCourse,
    stats: { successGroupCount: 1 },
    now: new Date('2026-03-29T12:30:00+08:00'),
    expectedStatus: COURSE_STATUS.FINISHED
  },
  {
    name: '报名截止时仍无成功团则进入拼团失败',
    course: baseCourse,
    stats: { successGroupCount: 0 },
    now: new Date('2026-03-28T18:00:00+08:00'),
    expectedStatus: COURSE_STATUS.GROUP_FAILED
  },
  {
    name: '到下架时间后进入已下架',
    course: {
      ...baseCourse,
      unpublish_time: '2026-03-27T08:00:00+08:00'
    },
    stats: { successGroupCount: 0 },
    now: new Date('2026-03-27T12:00:00+08:00'),
    expectedStatus: COURSE_STATUS.UNPUBLISHED
  }
]

const results = scenarios.map(assertScenario)
const failed = results.filter(item => !item.passed)

for (const result of results) {
  const marker = result.passed ? 'PASS' : 'FAIL'
  console.log(
    `[${marker}] ${result.name} | expected=${STATUS_TEXT[result.expectedStatus]} actual=${STATUS_TEXT[result.actualStatus]}`
  )
}

if (failed.length) {
  console.error(`\n${failed.length} 个场景未通过`)
  process.exit(1)
}

console.log(`\n${results.length} 个课程状态场景全部通过`)
