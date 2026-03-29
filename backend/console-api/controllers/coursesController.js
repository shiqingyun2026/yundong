const { createOkHandler } = require('./_helpers')
const {
  createCourse,
  geocodeCourseAddress,
  getCourseDetail,
  listCourseGroups,
  listCourses,
  offlineCourse,
  updateCourse
} = require('../services/coursesService')

const geocodeCourseHandler = createOkHandler('解析坐标失败', req =>
  geocodeCourseAddress({
    district: req.body && req.body.district,
    detail: req.body && req.body.detail
  })
)

const listCoursesHandler = createOkHandler('获取课程列表失败', req =>
  listCourses({
    query: req.query || {},
    admin: req.admin || {}
  })
)

const getCourseDetailHandler = createOkHandler('获取课程详情失败', req =>
  getCourseDetail({
    courseId: req.params.id,
    admin: req.admin || {}
  })
)

const listCourseGroupsHandler = createOkHandler('获取课程拼团列表失败', req =>
  listCourseGroups({
    courseId: req.params.id
  })
)

const createCourseHandler = createOkHandler('创建课程失败', req =>
  createCourse({
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const updateCourseHandler = createOkHandler('更新课程失败', req =>
  updateCourse({
    courseId: req.params.id,
    payload: req.body || {},
    admin: req.admin || {},
    ip: req.ip || null
  })
)

const offlineCourseHandler = createOkHandler('下架课程失败', req =>
  offlineCourse({
    courseId: req.params.id,
    admin: req.admin || {},
    ip: req.ip || null
  })
)

module.exports = {
  createCourseHandler,
  geocodeCourseHandler,
  getCourseDetailHandler,
  listCourseGroupsHandler,
  listCoursesHandler,
  offlineCourseHandler,
  updateCourseHandler
}
