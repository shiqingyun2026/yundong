const express = require('../lib/mini-express')

const { env } = require('../config/env')
const authenticate = require('../middleware/auth')
const { getSupabaseClient } = require('../utils/getSupabaseClient')
const { createPackageJoinOrder, createPackageStartOrder } = require('../shared/services/packageOrders')
const { isPackageServiceError } = require('../shared/services/packageServiceError')
const { ok, fail } = require('./_helpers')
const { formatFenText } = require('../shared/services/packageReaders')

const router = express.Router()
const resolveSupabase = () => (env.useMySqlRepositories ? null : getSupabaseClient())

router.post('/start', authenticate, async (req, res) => {
  try {
    const { packageId, targetCount, scheduleType, scheduleDate, scheduleDays, scheduleTime, scheduleList, childNickname, childAge, parentMobile } = req.body || {}
    const result = await createPackageStartOrder({
      supabase: resolveSupabase(),
      userId: req.userId,
      packageId,
      targetCount,
      scheduleType,
      scheduleDate,
      scheduleDays,
      scheduleTime,
      scheduleList,
      childNickname,
      childAge,
      parentMobile
    })

    return ok(res, {
      orderId: result.order.id,
      orderNo: result.order.order_no,
      orderType: result.order.order_type,
      action: result.order.package_action,
      packageId: result.order.package_id,
      targetCount: Number(targetCount),
      schedule_type: (result.scheduleConfig && result.scheduleConfig.schedule_type) || '',
      schedule_date: (result.scheduleConfig && result.scheduleConfig.schedule_date) || '',
      schedule_days: (result.scheduleConfig && result.scheduleConfig.schedule_days) || [],
      schedule_time: (result.scheduleConfig && result.scheduleConfig.schedule_time) || '',
      schedule_list: (result.scheduleConfig && result.scheduleConfig.schedule_list) || [],
      child_nickname: result.childNickname,
      child_age: result.childAge,
      parent_mobile: result.parentMobile,
      member_amount_fen: result.memberAmountFen,
      member_amount_text: formatFenText(result.memberAmountFen),
      status: result.order.status
    })
  } catch (error) {
    return fail(res, isPackageServiceError(error) ? error.code : 5000, error.message || 'failed to create package start order', error.status || 500)
  }
})

router.post('/join', authenticate, async (req, res) => {
  try {
    const { packageId, packageGroupId, childNickname, childAge, parentMobile } = req.body || {}
    const result = await createPackageJoinOrder({
      supabase: resolveSupabase(),
      userId: req.userId,
      packageId,
      packageGroupId,
      childNickname,
      childAge,
      parentMobile
    })

    return ok(res, {
      orderId: result.order.id,
      orderNo: result.order.order_no,
      orderType: result.order.order_type,
      action: result.order.package_action,
      packageId: result.order.package_id,
      packageGroupId: result.order.package_group_id,
      child_nickname: result.childNickname,
      child_age: result.childAge,
      parent_mobile: result.parentMobile,
      member_amount_fen: result.memberAmountFen,
      member_amount_text: formatFenText(result.memberAmountFen),
      status: result.order.status
    })
  } catch (error) {
    return fail(res, isPackageServiceError(error) ? error.code : 5000, error.message || 'failed to create package join order', error.status || 500)
  }
})

module.exports = router
