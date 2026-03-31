const { formatCourseTimeRange, formatPrice, formatTime } = require('./util')
const {
  MOCK_COURSES,
  GROUP_DETAIL_MAP,
  ACTIVE_GROUP_MAP,
  MOCK_PAYMENT_PARAMS,
  USER_GROUP_STATUS_MAP
} = require('./courseFixtures')
const {
  mapCourseListItem,
  mapCourseDetail,
  mapGroupDetail,
  mapUserGroupListItem
} = require('./courseTransforms')

const shouldForceMock = () => {
  try {
    const app = getApp()
    return !!(app && app.globalData && app.globalData.forceMock)
  } catch (error) {
    return false
  }
}

const shouldFallbackToMockByDefault = error => {
  if (!error) {
    return true
  }

  if (error.statusCode) {
    return false
  }

  if (error.code) {
    return false
  }

  return true
}

const withMockFallback = async ({ label, request, mockFactory, shouldFallback }) => {
  if (shouldForceMock()) {
    console.log(`[course] ${label} force mock enabled`)
    return mockFactory()
  }

  try {
    console.log(`[course] ${label} requesting backend`)
    return await request()
  } catch (error) {
    const allowFallback =
      typeof shouldFallback === 'function' ? shouldFallback(error) : shouldFallbackToMockByDefault(error)

    if (!allowFallback) {
      throw error
    }

    console.log(`[course] ${label} fallback to mock`, error)
    return mockFactory()
  }
}

const getMockCourses = ({ sort = 'distance', page = 1, pageSize = 10 }) => {
  const sortedCourses = [...MOCK_COURSES].sort((prev, next) => {
    if (sort === 'time') {
      return new Date(prev.startTime).getTime() - new Date(next.startTime).getTime()
    }

    return prev.distanceKm - next.distanceKm
  })

  const start = (page - 1) * pageSize
  const list = sortedCourses.slice(start, start + pageSize).map(mapCourseListItem)

  return {
    list,
    page,
    pageSize,
    total: sortedCourses.length,
    hasMore: start + pageSize < sortedCourses.length
  }
}

const getMockCourseListAsync = ({ lat, lng, sort, page, pageSize }) =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve(getMockCourses({ lat, lng, sort, page, pageSize }))
    }, 250)
  })

const getMockCourseDetailAsync = id =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      const target = MOCK_COURSES.find(item => item.id === id)
      if (!target) {
        reject(new Error('course not found'))
        return
      }

      resolve(mapCourseDetail(target))
    }, 200)
  })

const getMockActiveGroupAsync = id =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve(ACTIVE_GROUP_MAP[id] || null)
    }, 180)
  })

const getMockGroupDetailAsync = groupId =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (groupId && groupId.indexOf('mock-group-') === 0) {
        const courseId = groupId.replace('mock-group-', '')
        const course = MOCK_COURSES.find(item => item.id === courseId)

        if (!course) {
          reject(new Error('group not found'))
          return
        }

        resolve({
          groupId,
          courseId,
          status: 'ongoing',
          currentCount: 1,
          targetCount: course.targetCount,
          remainingSeconds: 24 * 3600,
          refundDesc: '截止时间未成团将自动原路退款',
          deadlineText: formatTime(new Date(new Date(course.startTime).getTime() - 12 * 3600 * 1000)),
          userJoined: true,
          members: [
            {
              avatar: 'https://dummyimage.com/96x96/e8f3ff/1677ff.png&text=ME',
              nickName: '我'
            }
          ],
          courseInfo: {
            id: course.id,
            title: course.title,
            groupPriceText: formatPrice(course.groupPrice),
            originalPriceText: formatPrice(course.originalPrice),
            targetCount: course.targetCount,
            joinedCount: 1,
            timeText: formatCourseTimeRange(course.startTime, course.endTime),
            locationText: course.location,
            ageRange: course.ageRange,
            cover: course.cover
          }
        })
        return
      }

      const groupDetail = GROUP_DETAIL_MAP[groupId]
      if (!groupDetail) {
        reject(new Error('group not found'))
        return
      }

      const course = MOCK_COURSES.find(item => item.id === groupDetail.courseId)
      resolve(mapGroupDetail(groupId, course, GROUP_DETAIL_MAP))
    }, 180)
  })

const getMockUserGroupListAsync = ({ status, page, pageSize }) =>
  new Promise(resolve => {
    setTimeout(() => {
      const matchedStatus = USER_GROUP_STATUS_MAP[status] || ''
      const rawList = Object.values(GROUP_DETAIL_MAP)
        .filter(item => !matchedStatus || item.status === matchedStatus)
        .map(item => {
          const course = MOCK_COURSES.find(courseItem => courseItem.id === item.courseId)
          if (!course) {
            return null
          }

          return {
            ...mapUserGroupListItem(item),
            cover: course.cover,
            title: course.title,
            timeText: formatCourseTimeRange(course.startTime, course.endTime),
            locationText: course.location
          }
        })
        .filter(Boolean)

      const start = (page - 1) * pageSize
      const list = rawList.slice(start, start + pageSize)

      resolve({
        list,
        page,
        pageSize,
        total: rawList.length,
        hasMore: start + pageSize < rawList.length
      })
    }, 180)
  })

const createMockOrder = ({ courseId, groupId, totalFee }) => ({
  orderId: `mock-order-${Date.now()}`,
  courseId,
  groupId: groupId || `mock-group-${courseId}`,
  paymentParams: {
    ...MOCK_PAYMENT_PARAMS,
    timeStamp: `${Math.floor(Date.now() / 1000)}`,
    total_fee: Number(totalFee) || 0
  }
})

module.exports = {
  withMockFallback,
  getMockCourseListAsync,
  getMockCourseDetailAsync,
  getMockActiveGroupAsync,
  getMockGroupDetailAsync,
  getMockUserGroupListAsync,
  createMockOrder
}
