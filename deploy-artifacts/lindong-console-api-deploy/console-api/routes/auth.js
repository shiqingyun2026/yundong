const express = require('../../lib/mini-express')
const { login } = require('../controllers/authController')

const router = express.Router()

router.post('/', login)

module.exports = router
