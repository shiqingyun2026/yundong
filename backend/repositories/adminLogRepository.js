const { execute, query } = require('../config/db')

const normalizeAdminLog = row => {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    admin_id: row.admin_id,
    action: row.action,
    target_type: row.target_type || '',
    target_id: row.target_id || '',
    detail: row.detail || null,
    ip: row.ip || '',
    created_at: row.created_at || null
  }
}

const createAdminLog = async ({ adminId, action, targetType = '', targetId = '', detail = null, ip = null }) => {
  const result = await execute(
    `
      insert into admin_log (
        admin_id,
        action,
        target_type,
        target_id,
        detail,
        ip
      ) values (?, ?, ?, ?, ?, ?)
    `,
    [
      adminId,
      action,
      targetType || null,
      targetId || null,
      detail ? JSON.stringify(detail) : null,
      ip || null
    ]
  )

  const rows = await query(
    `
      select id, admin_id, action, target_type, target_id, detail, ip, created_at
      from admin_log
      where id = ?
      limit 1
    `,
    [result.insertId]
  )

  return normalizeAdminLog(rows[0])
}

const listAdminLogs = async ({ from = 0, size = 10 } = {}) => {
  const totalRows = await query('select count(*) as total from admin_log')
  const rows = await query(
    `
      select id, admin_id, action, target_type, target_id, detail, ip, created_at
      from admin_log
      order by created_at desc, id desc
      limit ?
      offset ?
    `,
    [size, from]
  )

  return {
    total: Number(totalRows[0] && totalRows[0].total) || 0,
    list: rows.map(normalizeAdminLog)
  }
}

module.exports = {
  createAdminLog,
  listAdminLogs
}
