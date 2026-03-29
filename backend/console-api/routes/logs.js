const express = require('../../lib/mini-express')
const { listLogs } = require('../controllers/logsController')

const router = express.Router()

router.get('/', listLogs)

module.exports = router
