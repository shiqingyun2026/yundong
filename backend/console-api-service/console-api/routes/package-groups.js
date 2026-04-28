const express = require('../../lib/mini-express')
const {
  getAdminPackageGroupDetailHandler,
  listAdminPackageGroupsHandler,
  updateAdminPackageGroupCoachAssignmentHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageGroupsHandler)
router.get('/:id', getAdminPackageGroupDetailHandler)
router.put('/:id/coach-assignment', updateAdminPackageGroupCoachAssignmentHandler)

module.exports = router
