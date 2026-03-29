const express = require('../../lib/mini-express')
const { signUpload } = require('../controllers/uploadController')

const router = express.Router()

router.post('/sign', signUpload)

module.exports = router
