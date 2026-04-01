const { get, post } = require('./request')
const {
  normalizeListPayload,
  normalizeCourseListItem,
  normalizeCourseDetail,
  normalizeActiveGroup,
  normalizeGroupDetail,
  normalizeUserGroupListItem
} = require('./courseTransforms')
const {
  withMockFallback,
  getMockCourseListAsync,
  getMockCourseDetailAsync,
  getMockActiveGroupAsync,
  getMockGroupDetailAsync,
  getMockUserGroupListAsync,
  createMockOrder
} = require('./courseMock')

const fetchCourseList = async ({ lat, lng, sort = 'distance', page = 1, pageSize = 10 }) => {
  return withMockFallback({
    label: 'fetchCourseList',
    request: async () => {
      const response = await get('/api/courses', {
        lat,
        lng,
        sort,
        page,
        pageSize
      })
      const payload = normalizeListPayload(response)

      return {
        ...payload,
        list: payload.list.map(normalizeCourseListItem)
      }
    },
    mockFactory: () => getMockCourseListAsync({ lat, lng, sort, page, pageSize }),
    shouldFallback: false
  })
}

const fetchCourseDetail = async id => {
  return withMockFallback({
    label: 'fetchCourseDetail',
    request: async () => normalizeCourseDetail(await get(`/api/courses/${id}`)),
    mockFactory: () => getMockCourseDetailAsync(id),
    shouldFallback: false
  })
}

const fetchActiveGroup = async id => {
  return withMockFallback({
    label: 'fetchActiveGroup',
    request: async () => normalizeActiveGroup(await get(`/api/courses/${id}/active-group`)),
    mockFactory: () => getMockActiveGroupAsync(id),
    shouldFallback: false
  })
}

const fetchGroupDetail = async groupId => {
  return withMockFallback({
    label: 'fetchGroupDetail',
    request: async () => {
      const payload = await get(`/api/groups/${groupId}`, {}, { showErrorToast: false })
      return normalizeGroupDetail(payload)
    },
    mockFactory: () => getMockGroupDetailAsync(groupId),
    shouldFallback: false
  })
}

const createOrder = async ({ courseId, groupId, totalFee }) =>
  withMockFallback({
    label: 'createOrder',
    request: () =>
      post(
        '/api/orders',
        {
          courseId,
          groupId
        },
        {
          showLoading: true,
          loadingText: '提交中',
          showErrorToast: false
        }
      ),
    mockFactory: () =>
      Promise.resolve(
        createMockOrder({
          courseId,
          groupId,
          totalFee
        })
      ),
    shouldFallback: false
  })

const mockPaymentSuccess = async ({ orderId, groupId }) =>
  post(
    '/api/payments/mock-success',
    {
      orderId,
      groupId
    },
    {
      showLoading: true,
      loadingText: '支付中',
      showErrorToast: false
    }
  )

const preparePayment = async ({ orderId }) =>
  post(
    '/api/payments/prepare',
    {
      orderId
    },
    {
      showLoading: true,
      loadingText: '拉起支付中',
      showErrorToast: false
    }
  )

const fetchOrderDetail = async orderId =>
  get(
    `/api/orders/${orderId}`,
    {},
    {
      showErrorToast: false
    }
  )

const fetchUserGroupList = async ({ status = 'all', page = 1, pageSize = 10 }) => {
  return withMockFallback({
    label: 'fetchUserGroupList',
    request: async () => {
      const response = await get(
        '/api/user/groups',
        {
          status,
          page,
          pageSize
        },
        {
          showErrorToast: false
        }
      )
      const payload = normalizeListPayload(response)

      return {
        ...payload,
        list: payload.list.map(normalizeUserGroupListItem)
      }
    },
    mockFactory: () => getMockUserGroupListAsync({ status, page, pageSize }),
    shouldFallback: false
  })
}

module.exports = {
  fetchCourseList,
  fetchCourseDetail,
  fetchActiveGroup,
  fetchGroupDetail,
  createOrder,
  preparePayment,
  mockPaymentSuccess,
  createMockOrder,
  fetchUserGroupList,
  fetchOrderDetail
}
