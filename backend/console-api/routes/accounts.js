const express = require('../../lib/mini-express')

const { requireSuperAdmin } = require('../../middleware/adminAuth')
const {
  createAccountHandler,
  deleteAccountHandler,
  listAccounts,
  updateAccountHandler
} = require('../controllers/accountsController')

const router = express.Router()

router.get('/', requireSuperAdmin, listAccounts)
router.post('/', requireSuperAdmin, createAccountHandler)
router.put('/:id', requireSuperAdmin, updateAccountHandler)
router.delete('/:id', requireSuperAdmin, deleteAccountHandler)

module.exports = router
