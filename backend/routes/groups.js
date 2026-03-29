const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { fetchMiniProgramGroupDetail } = require('../shared/services/groupReaders')

const router = express.Router()

router.get('/:id', authenticate, async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramGroupDetail({
        supabase,
        groupId: req.params.id,
        userId: req.userId
      })
    )
  } catch (error) {
    console.error('[groups/:id] failed to fetch group detail', {
      groupId: req.params.id,
      userId: req.userId,
      error
    })
    return res.status(error.statusCode || 500).json({
      message: error.message || 'failed to fetch group detail'
    })
  }
})

module.exports = router
