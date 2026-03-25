require('dotenv').config()

const { ensureBootstrapAdmin, hasAdminUsersTable } = require('../utils/adminStore')

async function main() {
  const hasTable = await hasAdminUsersTable()

  if (!hasTable) {
    console.log('admin_users table not found. Run backend/migrations/20260325_admin_console.sql first.')
    return
  }

  const result = await ensureBootstrapAdmin()
  console.log(`Bootstrap admin ${result.mode}: ${result.admin.username} (${result.admin.id})`)
  console.log('Password source: backend .env bootstrap credentials')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
