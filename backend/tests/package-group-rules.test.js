const assert = require('node:assert/strict')
const test = require('node:test')

const {
  PACKAGE_GROUP_STATUS,
  assertSupportedTargetCount,
  buildPackageDeadline,
  buildPackageDeadlineFromPackage,
  buildPackageGroupCreationPayload,
  calculatePackageMemberAmountFen,
  calculatePackagePlatformSubsidyFen,
  computePackageGroupDeadlineStatus,
  computePackageGroupNextStatus,
  findGroupPriceFen,
  isPackageGroupJoinable
} = require('../lindong-api/shared/domain/packageGroupRules')
const {
  buildPackageLessonSchedule,
  computeFirstPackageClassTime,
  formatPackageDateTime,
  formatPackageHourLabel,
  formatPackageWeekdayLabel,
  formatPendingPackageScheduleText,
  formatScheduleTextWithLockNote,
  normalizeHour,
  normalizeWeekday
} = require('../lindong-api/shared/services/packageSchedule')

test('package group rules calculate member amount and platform subsidy', () => {
  assert.equal(calculatePackageMemberAmountFen({ totalPrice: 133333, targetCount: 8 }), 16666)
  assert.equal(calculatePackagePlatformSubsidyFen({ totalPrice: 133333, targetCount: 8 }), 5)
  assert.equal(calculatePackageMemberAmountFen({ totalPrice: -1, targetCount: 4 }), 0)
  assert.equal(calculatePackageMemberAmountFen({ totalPrice: 100, targetCount: 0 }), 0)
  assert.equal(
    calculatePackageMemberAmountFen({
      totalPrice: 133333,
      targetCount: 4,
      groupPriceConfig: [{ target_count: 4, price_fen: 29900 }]
    }),
    29900
  )
  assert.equal(
    findGroupPriceFen({
      targetCount: 6,
      groupPriceConfig: [{ target_count: 6, price_fen: 25500 }]
    }),
    25500
  )
})

test('package group rules build deadline and next status', () => {
  const deadline = buildPackageDeadline({
    createdAt: '2026-04-19T10:00:00.000Z',
    deadlineHours: 45
  })
  const packageDeadline = buildPackageDeadlineFromPackage({
    createdAt: '2026-04-19T10:00:00.000Z',
    pkg: {
      deadline_hours: 45
    }
  })
  const fallbackDeadline = buildPackageDeadlineFromPackage({
    createdAt: '2026-04-19T10:00:00.000Z',
    pkg: {
      deadline_hours: 0
    }
  })

  assert.equal(deadline.toISOString(), '2026-04-21T07:00:00.000Z')
  assert.equal(packageDeadline.toISOString(), '2026-04-21T07:00:00.000Z')
  assert.equal(fallbackDeadline.toISOString(), '2026-04-21T10:00:00.000Z')
  assert.equal(
    computePackageGroupNextStatus({
      currentCount: 4,
      targetCount: 4,
      deadline: '2026-04-21T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.SUCCESS
  )
  assert.equal(
    computePackageGroupNextStatus({
      currentCount: 2,
      targetCount: 4,
      deadline: '2026-04-18T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.FAILED
  )
  assert.equal(
    computePackageGroupNextStatus({
      currentCount: 2,
      targetCount: 4,
      deadline: '2026-04-20T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.ACTIVE
  )
})

test('package group rules allow deadline success at configured minimum count', () => {
  assert.equal(
    computePackageGroupDeadlineStatus({
      currentCount: 3,
      targetCount: 4,
      minSuccessCount: 3,
      deadline: '2026-04-18T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.SUCCESS
  )
  assert.equal(
    computePackageGroupDeadlineStatus({
      currentCount: 2,
      targetCount: 4,
      minSuccessCount: 3,
      deadline: '2026-04-18T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.FAILED
  )
  assert.equal(
    computePackageGroupDeadlineStatus({
      currentCount: 5,
      targetCount: 6,
      minSuccessCount: 5,
      deadline: '2026-04-20T10:00:00.000Z',
      now: new Date('2026-04-19T10:00:00.000Z')
    }),
    PACKAGE_GROUP_STATUS.ACTIVE
  )
})

test('package group rules validate joinability and payload creation', () => {
  assert.equal(
    isPackageGroupJoinable(
      {
        status: 'active',
        current_count: 2,
        target_count: 4,
        deadline: '2026-04-20T10:00:00.000Z'
      },
      new Date('2026-04-19T10:00:00.000Z')
    ),
    true
  )
  assert.equal(
    isPackageGroupJoinable(
      {
        status: 'success',
        current_count: 4,
        target_count: 4,
        deadline: '2026-04-20T10:00:00.000Z'
      },
      new Date('2026-04-19T10:00:00.000Z')
    ),
    false
  )

  const payload = buildPackageGroupCreationPayload({
    packageId: 'pkg-1',
    creatorId: 'user-1',
    targetCount: 4,
    minSuccessCount: 3,
    weekday: 6,
    hour: 10,
    deadline: '2026-04-21T10:00:00.000Z'
  })
  assert.deepEqual(payload, {
    package_id: 'pkg-1',
    creator_id: 'user-1',
    target_count: 4,
    min_success_count: 3,
    current_count: 1,
    status: 'active',
    weekday: 6,
    hour: 10,
    schedule_config: null,
    first_class_time: null,
    deadline: '2026-04-21T10:00:00.000Z',
    created_at: payload.created_at,
    success_time: null
  })

  assert.doesNotThrow(() =>
    assertSupportedTargetCount({
      supportedPeople: [2, 4, 6, 8],
      targetCount: 4
    })
  )
  assert.throws(
    () =>
      assertSupportedTargetCount({
        supportedPeople: [2, 4, 6, 8],
        targetCount: 3
      }),
    /targetCount 不在课包支持范围内/
  )
})

test('package schedule normalizes and formats weekday/hour labels', () => {
  assert.equal(normalizeWeekday(6), 6)
  assert.equal(normalizeWeekday(8), 0)
  assert.equal(normalizeHour(10), 10)
  assert.equal(normalizeHour(24), -1)
  assert.equal(formatPackageWeekdayLabel(6), '周六')
  assert.equal(formatPackageHourLabel(10), '10:00')
  assert.equal(formatPendingPackageScheduleText({ weekday: 6, hour: 10 }), '每周六 10:00，共5次')
  assert.equal(formatScheduleTextWithLockNote({ weekday: 6, hour: 10 }), '每周六 10:00，共5次，成团后锁定课表')
  assert.equal(formatPendingPackageScheduleText({ weekday: 0, hour: 99 }), '时间待定')
})

test('package schedule computes first class time for same day and next week rollover', () => {
  const sameDay = computeFirstPackageClassTime({
    successTime: '2026-04-18T01:30:00.000Z',
    weekday: 6,
    hour: 10
  })
  const nextWeek = computeFirstPackageClassTime({
    successTime: '2026-04-18T03:30:00.000Z',
    weekday: 6,
    hour: 10
  })

  assert.equal(formatPackageDateTime(sameDay), '2026-04-25 10:00:00')
  assert.equal(formatPackageDateTime(nextWeek), '2026-04-25 10:00:00')
  assert.equal(
    computeFirstPackageClassTime({
      successTime: 'invalid-date',
      weekday: 6,
      hour: 10
    }),
    null
  )
})

test('package schedule builds five-week lesson schedule by default', () => {
  const schedule = buildPackageLessonSchedule({
    firstClassTime: '2026-04-25T02:00:00.000Z'
  })

  assert.equal(schedule.length, 5)
  assert.deepEqual(schedule[0], {
    index: 1,
    class_time: '2026-04-25 10:00:00',
    display_text: '2026-04-25 10:00:00'
  })
  assert.equal(schedule[4].class_time, '2026-05-23 10:00:00')
  assert.deepEqual(
    buildPackageLessonSchedule({
      firstClassTime: 'invalid-date'
    }),
    []
  )
})
