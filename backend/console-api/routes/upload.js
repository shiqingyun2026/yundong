const express = require('../../lib/mini-express')
const { signUpload, uploadImage } = require('../controllers/uploadController')

const router = express.Router()

router.post('/sign', signUpload)
router.post('/image', uploadImage)

module.exports = router
