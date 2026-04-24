const express = require('../../lib/mini-express')
const { adminAuthenticate } = require('../../middleware/adminAuth')
const { getSession, login, logout } = require('../controllers/authController')

const router = express.Router()

router.post('/', login)
router.post('/logout', logout)
router.get('/session', adminAuthenticate, getSession)

module.exports = router
