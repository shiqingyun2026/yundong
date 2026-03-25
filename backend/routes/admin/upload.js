const express = require('express')

const { fail } = require('./_helpers')

const router = express.Router()

router.post('/sign', async (req, res) => {
  return fail(res, 5000, '当前版本未接入 Supabase Storage 上传签名', 501)
})

module.exports = router
