const express = require('../../lib/mini-express')
const {
  getAdminPackageGroupDetailHandler,
  listAdminPackageGroupsHandler,
  refundAdminPackageGroupHandler,
  updateAdminPackageGroupCoachAssignmentHandler
} = require('../controllers/packageAdminController')

const router = express.Router()

router.get('/', listAdminPackageGroupsHandler)
router.get('/:id', getAdminPackageGroupDetailHandler)
router.post('/:id/refund', refundAdminPackageGroupHandler)
router.put('/:id/coach-assignment', updateAdminPackageGroupCoachAssignmentHandler)

module.exports = router
