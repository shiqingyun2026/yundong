const express = require('../../lib/mini-express')
const {
  createCourseHandler,
  geocodeCourseHandler,
  getCourseDetailHandler,
  listCourseGroupsHandler,
  listCoursesHandler,
  offlineCourseHandler,
  searchCourseLocationsHandler,
  updateCourseHandler
} = require('../controllers/coursesController')

const router = express.Router()

router.post('/geocode', geocodeCourseHandler)
router.get('/location-suggestions', searchCourseLocationsHandler)
router.get('/', listCoursesHandler)
router.get('/:id', getCourseDetailHandler)
router.get('/:id/groups', listCourseGroupsHandler)
router.post('/', createCourseHandler)
router.put('/:id', updateCourseHandler)
router.put('/:id/offline', offlineCourseHandler)

module.exports = router
