const { formatDateTime, getPagination } = require('../routes/_helpers')
const { ensureFeatureEnabled } = require('./_guards')
const { hasAdminLogTable } = require('../../utils/adminStore')
const supabase = require('../../utils/supabase')

const listAdminLogPage = async ({ query = {} }) => {
  const { page, size, from, to } = getPagination(query)
  const adminUsername = `${query.admin_username || ''}`.trim()
  const action = `${query.action || ''}`.trim()
  const targetType = `${query.target_type || ''}`.trim()
  const targetId = `${query.target_id || ''}`.trim()

  await ensureFeatureEnabled(hasAdminLogTable, '当前数据库未启用 admin_log，暂不支持查看操作日志')

  let adminIds = []
  if (adminUsername) {
    const { data: admins, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .ilike('username', `%${adminUsername}%`)

    if (adminError) {
      throw adminError
    }

    adminIds = (admins || []).map(item => item.id).filter(Boolean)
    if (!adminIds.length) {
      return { total: 0, list: [], page, size, total_pages: 1 }
    }
  }

  let queryBuilder = supabase
    .from('admin_log')
    .select('id, admin_id, action, target_type, target_id, detail, ip, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (adminIds.length) {
    queryBuilder = queryBuilder.in('admin_id', adminIds)
  }
  if (action) {
    queryBuilder = queryBuilder.eq('action', action)
  }
  if (targetType) {
    queryBuilder = queryBuilder.eq('target_type', targetType)
  }
  if (targetId) {
    queryBuilder = queryBuilder.ilike('target_id', `%${targetId}%`)
  }

  const { data, count, error } = await queryBuilder.range(from, to)

  if (error) {
    throw error
  }

  const logAdminIds = [...new Set((data || []).map(item => item.admin_id).filter(Boolean))]
  const { data: admins } = logAdminIds.length
    ? await supabase.from('admin_users').select('id, username, role').in('id', logAdminIds)
    : { data: [] }

  const adminsById = (admins || []).reduce((result, item) => {
    result[item.id] = item
    return result
  }, {})

  return {
    total: Number(count || 0),
    total_pages: Math.max(1, Math.ceil(Number(count || 0) / size)),
    list: (data || []).map(item => ({
      id: item.id,
      admin_id: item.admin_id || '',
      admin_username: (adminsById[item.admin_id] && adminsById[item.admin_id].username) || '',
      admin_role: (adminsById[item.admin_id] && adminsById[item.admin_id].role) || '',
      action: item.action || '',
      target_type: item.target_type || '',
      target_id: item.target_id || '',
      detail: item.detail || {},
      ip: item.ip || '',
      created_at: formatDateTime(item.created_at)
    })),
    page,
    size
  }
}

module.exports = {
  listAdminLogPage
}
