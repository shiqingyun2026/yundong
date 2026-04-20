const express = require('../../lib/mini-express')
const {
  getGroupDetailHandler,
  listGroupOrdersHandler,
  listGroupsHandler
} = require('../controllers/groupsController')

const router = express.Router()

router.get('/', listGroupsHandler)
router.get('/:id/orders', listGroupOrdersHandler)
router.get('/:id', getGroupDetailHandler)

module.exports = router
