const express = require('../lib/mini-express')

const supabase = require('../utils/supabase')
const { resolveUserIdFromAuthorization } = require('../shared/utils/auth')
const {
  fetchMiniProgramCourseActiveGroup,
  fetchMiniProgramCourseDetail,
  fetchMiniProgramCourseList
} = require('../shared/services/courseReaders')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramCourseList({
        supabase,
        page: req.query.page,
        pageSize: req.query.pageSize,
        sort: req.query.sort
      })
    )
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch courses'
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramCourseDetail({
        supabase,
        courseId: req.params.id
      })
    )
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'failed to fetch course detail'
    })
  }
})

router.get('/:id/active-group', async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramCourseActiveGroup({
        supabase,
        courseId: req.params.id,
        userId: resolveUserIdFromAuthorization(req.headers.authorization)
      })
    )
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch active group'
    })
  }
})

module.exports = router
