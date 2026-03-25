const express = require('express')

const authRoutes = require('./auth')
const coursesRoutes = require('./courses')
const ordersRoutes = require('./orders')
const accountsRoutes = require('./accounts')
const uploadRoutes = require('./upload')
const { adminAuthenticate } = require('../../middleware/adminAuth')

const router = express.Router()

router.use('/login', authRoutes)
router.use('/courses', adminAuthenticate, coursesRoutes)
router.use('/orders', adminAuthenticate, ordersRoutes)
router.use('/accounts', adminAuthenticate, accountsRoutes)
router.use('/upload', adminAuthenticate, uploadRoutes)

module.exports = router
