const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { fetchMiniProgramUserGroupList } = require('../shared/services/groupReaders')

const router = express.Router()

router.get('/groups', authenticate, async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramUserGroupList({
        supabase,
        userId: req.userId,
        status: req.query.status,
        page: req.query.page,
        pageSize: req.query.pageSize
      })
    )
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch user groups'
    })
  }
})

module.exports = router
