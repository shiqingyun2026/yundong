const express = require('../../lib/mini-express')
const { adminAuthenticate } = require('../../middleware/adminAuth')
const { getPackageRefundFlowProbe, getSession, login, logout } = require('../controllers/authController')

const router = express.Router()

router.post('/', login)
router.post('/logout', logout)
router.get('/package-refund-flow', getPackageRefundFlowProbe)
router.get('/session', adminAuthenticate, getSession)

module.exports = router
