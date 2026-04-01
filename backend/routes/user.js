const express = require('../lib/mini-express')

const authenticate = require('../middleware/auth')
const supabase = require('../utils/supabase')
const { fetchMiniProgramUserGroupList } = require('../shared/services/groupReaders')

const router = express.Router()

router.get('/groups', authenticate, async (req, res) => {
  try {
    return res.json(
      await fetchMiniProgramUserGroupList({
        supabase,
        userId: req.userId,
        status: req.query.status,
        page: req.query.page,
        pageSize: req.query.pageSize
      })
    )
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'failed to fetch user groups'
    })
  }
})

router.post('/group-result-subscriptions', authenticate, async (req, res) => {
  const {
    scene = 'group_result',
    templateKey = 'groupResult',
    templateId = '',
    groupId = '',
    courseId = '',
    decision = 'unknown',
    status = 'unsubscribed',
    reason = '',
    rawResult = null
  } = req.body || {}

  if (!groupId || !courseId) {
    return res.status(400).json({
      message: 'groupId and courseId are required'
    })
  }

  try {
    const now = new Date().toISOString()
    const payload = {
      user_id: req.userId,
      group_id: groupId,
      course_id: courseId,
      scene,
      template_key: templateKey,
      template_id: templateId,
      decision,
      status,
      reason,
      raw_result: rawResult,
      requested_at: now,
      updated_at: now
    }

    const { data, error } = await supabase
      .from('group_result_subscriptions')
      .upsert(payload, {
        onConflict: 'user_id,group_id,template_key'
      })
      .select(
        'id, user_id, group_id, course_id, scene, template_key, template_id, decision, status, reason, requested_at, updated_at'
      )
      .single()

    if (error) {
      throw error
    }

    return res.json(data)
  } catch (error) {
    console.error('[user/group-result-subscriptions] failed', {
      userId: req.userId,
      groupId,
      courseId,
      error
    })

    return res.status(500).json({
      message: error.message || 'failed to save group result subscription'
    })
  }
})

module.exports = router
