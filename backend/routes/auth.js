const express = require('../lib/mini-express')

const supabase = require('../utils/supabase')
const { loginMiniProgramUser } = require('../shared/services/miniProgramAuth')

const router = express.Router()

router.post('/login', async (req, res) => {
  const { code, mockOpenId } = req.body || {}

  if (!code) {
    return res.status(400).json({
      message: 'code is required'
    })
  }

  try {
    return res.json(
      await loginMiniProgramUser({
        supabase,
        code,
        mockOpenId
      })
    )
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'login failed'
    })
  }
})

module.exports = router
