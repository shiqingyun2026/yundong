const express = require('../../lib/mini-express')

const authRoutes = require('./auth')
const coursesRoutes = require('./courses')
const groupsRoutes = require('./groups')
const ordersRoutes = require('./orders')
const accountsRoutes = require('./accounts')
const logsRoutes = require('./logs')
const dashboardRoutes = require('./dashboard')
const uploadRoutes = require('./upload')
const { adminAuthenticate } = require('../../middleware/adminAuth')

const router = express.Router()

router.use('/login', authRoutes)
router.use('/courses', adminAuthenticate, coursesRoutes)
router.use('/groups', adminAuthenticate, groupsRoutes)
router.use('/orders', adminAuthenticate, ordersRoutes)
router.use('/accounts', adminAuthenticate, accountsRoutes)
router.use('/logs', adminAuthenticate, logsRoutes)
router.use('/dashboard', adminAuthenticate, dashboardRoutes)
router.use('/upload', adminAuthenticate, uploadRoutes)

module.exports = router
