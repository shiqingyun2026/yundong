const express = require('../../lib/mini-express')
const { getOverviewHandler } = require('../controllers/dashboardController')

const router = express.Router()

router.get('/overview', getOverviewHandler)

module.exports = router
