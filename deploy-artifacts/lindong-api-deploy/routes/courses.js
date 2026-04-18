const express = require('../lib/mini-express')

const { env } = require('../config/env')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { resolveOptionalMiniProgramUser } = require('../shared/utils/miniProgramIdentity')
const { logMiniProgramIdentity } = require('../shared/utils/miniProgramIdentityLog')
const {
  fetchMiniProgramCourseActiveGroup,
  fetchMiniProgramCourseDetail,
  fetchMiniProgramCourseList
} = require('../shared/services/courseReaders')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.get('/', async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramCourseList({
        supabase: resolveSupabase(),
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
        supabase: resolveSupabase(),
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
    const identity = await resolveOptionalMiniProgramUser({
      headers: req.headers
    })

    logMiniProgramIdentity({
      route: req.path,
      source: identity.source,
      headers: req.headers,
      userId: identity.userId,
      extra: {
        courseId: req.params.id
      }
    })

    return res.json(
      await fetchMiniProgramCourseActiveGroup({
        supabase: resolveSupabase(),
        courseId: req.params.id,
        userId: identity.userId
      })
    )
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch active group'
    })
  }
})

module.exports = router
