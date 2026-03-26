const express = require('express')

const { ok, fail, getPagination, formatDateTime } = require('./_helpers')
const { hasAdminLogTable } = require('../../utils/adminStore')
const supabase = require('../../utils/supabase')

const router = express.Router()

router.get('/', async (req, res) => {
  const { page, size, from, to } = getPagination(req.query || {})
  const adminUsername = `${req.query.admin_username || ''}`.trim()
  const action = `${req.query.action || ''}`.trim()
  const targetType = `${req.query.target_type || ''}`.trim()
  const targetId = `${req.query.target_id || ''}`.trim()

  try {
    if (!(await hasAdminLogTable())) {
      return fail(res, 5000, '当前数据库未启用 admin_log，暂不支持查看操作日志', 501)
    }

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
        return ok(res, { total: 0, list: [], page, size })
      }
    }

    let query = supabase
      .from('admin_log')
      .select('id, admin_id, action, target_type, target_id, detail, ip, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (adminIds.length) {
      query = query.in('admin_id', adminIds)
    }
    if (action) {
      query = query.eq('action', action)
    }
    if (targetType) {
      query = query.eq('target_type', targetType)
    }
    if (targetId) {
      query = query.ilike('target_id', `%${targetId}%`)
    }

    const { data, count, error } = await query.range(from, to)

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

    return ok(res, {
      total: Number(count || 0),
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
    })
  } catch (error) {
    return fail(res, 5000, error.message || '获取操作日志失败', 500)
  }
})

module.exports = router
