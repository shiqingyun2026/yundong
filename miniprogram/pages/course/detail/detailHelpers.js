const resolveExpireTime = activeGroup => {
  const expireDate = activeGroup && activeGroup.expireTime ? new Date(activeGroup.expireTime) : null
  if (expireDate && !Number.isNaN(expireDate.getTime())) {
    return expireDate.toISOString()
  }

  const remainingSeconds = Math.max(0, Number(activeGroup && activeGroup.remainingSeconds) || 0)
  if (remainingSeconds > 0) {
    return new Date(Date.now() + remainingSeconds * 1000).toISOString()
  }

  return ''
}

const formatExpireTime = expireTime => {
  if (!expireTime) {
    return '已结束'
  }

  const expireDate = new Date(expireTime)
  if (Number.isNaN(expireDate.getTime())) {
    return '已结束'
  }

  const diff = expireDate.getTime() - Date.now()
  if (diff <= 0) {
    return '已结束'
  }

  const totalMinutes = Math.floor(diff / 60000)
  const totalHours = Math.floor(diff / 3600000)
  const days = Math.floor(totalHours / 24)

  if (days >= 1) {
    return `剩余 ${days} 天 ${totalHours % 24} 小时`
  }

  if (totalHours >= 1) {
    return `剩余 ${totalHours} 小时`
  }

  if (totalMinutes >= 1) {
    return `剩余 ${totalMinutes} 分钟`
  }

  return '已结束'
}

const getExpireMeta = expireTime => {
  const formatted = formatExpireTime(expireTime)
  if (formatted === '已结束') {
    return {
      text: '已结束',
      tone: 'ended',
      hint: '该拼团已截止，可重新开团'
    }
  }

  const diff = new Date(expireTime).getTime() - Date.now()
  const totalHours = Math.floor(diff / 3600000)
  if (totalHours < 1) {
    return { text: formatted, tone: 'urgent', hint: '即将截止，邀请好友一起拼更稳妥' }
  }

  if (totalHours < 24) {
    return { text: formatted, tone: 'warning', hint: '拼团正在进行中，尽快凑齐人数' }
  }

  return { text: formatted, tone: 'normal', hint: '拼团仍在进行中，可邀请好友加入' }
}

const getGroupPresentationMeta = activeGroup => {
  const status = (activeGroup && activeGroup.status) || 'ongoing'
  if (status === 'success') {
    return { text: '已成团', tone: 'success', hint: '当前课程拼团已完成，请等待上课安排。', isExpired: false }
  }

  if (status === 'failed') {
    return { text: '已失败', tone: 'ended', hint: '当前拼团已结束，可重新开团。', isExpired: true }
  }

  const expireTime = resolveExpireTime(activeGroup)
  const expireMeta = getExpireMeta(expireTime)

  return {
    ...expireMeta,
    expireTime,
    isExpired: expireMeta.text === '已结束'
  }
}

const buildActiveGroupViewModel = activeGroup => {
  if (!activeGroup) {
    return null
  }

  const currentCount = Number(activeGroup.currentCount) || 0
  const targetCount = Number(activeGroup.targetCount) || 0
  const presentationMeta = getGroupPresentationMeta(activeGroup)
  const expireTime = presentationMeta.expireTime || resolveExpireTime(activeGroup)

  return {
    ...activeGroup,
    expireTime,
    expireTimeText: presentationMeta.text,
    expireTone: presentationMeta.tone,
    expireHint: presentationMeta.hint,
    isExpired: presentationMeta.isExpired,
    remainingCount: Math.max(0, targetCount - currentCount),
    progressText: `${currentCount}/${targetCount}`,
    progressPercent: targetCount > 0 ? `${(currentCount / targetCount) * 100}%` : '0%'
  }
}

const buildCourseGroupList = groupList =>
  (groupList || []).map((group, index) => {
    const currentCount = Number(group.currentCount) || 0
    const targetCount = Number(group.targetCount) || 0
    const status = group.status || ''
    const expireValue = resolveExpireTime(group)
    const expireText = expireValue ? formatExpireTime(expireValue) : '已结束'

    return {
      ...group,
      index: index + 1,
      progressText: `${currentCount}/${targetCount}`,
      statusText: status === 'ongoing' ? '进行中' : status === 'success' ? '已成团' : '已结束',
      statusClass: status === 'ongoing' ? 'ongoing' : status === 'success' ? 'success' : 'failed',
      caption: status === 'ongoing' ? `截止 ${expireText}` : status === 'success' ? '该团已拼团成功' : '该团已结束',
      progressPercent: targetCount > 0 ? `${(currentCount / targetCount) * 100}%` : '0%'
    }
  })

const normalizeCourseDetail = detail => {
  if (!detail) {
    return null
  }

  return {
    ...detail,
    title: detail.title || detail.name || '',
    images: Array.isArray(detail.images) && detail.images.length ? detail.images : (detail.cover ? [detail.cover] : []),
    groupPriceText:
      detail.groupPriceText !== undefined ? `${detail.groupPriceText}` : Number(detail.group_price || detail.groupPrice || 0).toFixed(2),
    originalPriceText:
      detail.originalPriceText !== undefined ? `${detail.originalPriceText}` : Number(detail.original_price || detail.originalPrice || 0).toFixed(2),
    timeText: detail.timeText || detail.start_time || '',
    locationText: detail.locationText || detail.address || detail.location || '',
    ageRange: detail.ageRange || detail.age_range || detail.age_limit || '',
    descriptionHtml: detail.descriptionHtml || detail.description_html || '',
    maxGroups: Number(detail.maxGroups ?? detail.max_groups) || 0,
    completedGroupsCount: Number(detail.completedGroupsCount ?? detail.completed_groups_count) || 0,
    successJoinedCount: Number(detail.successJoinedCount ?? detail.success_joined_count) || 0,
    groupList: buildCourseGroupList(detail.groupList || detail.group_list || []),
    descriptionNodes: detail.descriptionNodes || [],
    groupRuleNodes: detail.groupRuleNodes || [],
    insuranceText: detail.insuranceText || detail.insurance_text || detail.insurance_desc || '',
    serviceQrCode: detail.serviceQrCode || '',
    coach: {
      name: (detail.coach && detail.coach.name) || detail.coach_name || '教练待定',
      intro: (detail.coach && detail.coach.intro) || detail.coach_intro || '',
      certificates:
        (detail.coach && Array.isArray(detail.coach.certificates) && detail.coach.certificates) ||
        detail.coach_certificates ||
        []
    }
  }
}

const buildGroupPresentationState = ({ courseDetail, activeGroup }) => {
  const hasJoinableGroup = !!(activeGroup && activeGroup.status === 'ongoing' && !activeGroup.isExpired)
  const hasActiveGroup = !!(activeGroup && activeGroup.status === 'ongoing')
  const groupTargetCount = hasActiveGroup ? Number(activeGroup.targetCount) || 0 : 0
  const groupCurrentCount = hasActiveGroup ? Number(activeGroup.currentCount) || 0 : 0
  const isUserJoined = !!(hasJoinableGroup && activeGroup.userJoined)
  const completedGroupsCount = Number(courseDetail && courseDetail.completedGroupsCount) || 0
  const maxGroups = Number(courseDetail && courseDetail.maxGroups) || 0
  const successJoinedCount = Number(courseDetail && courseDetail.successJoinedCount) || 0
  const canCreateGroup = maxGroups <= 0 || completedGroupsCount < maxGroups
  const displayJoinedCount = successJoinedCount
  const showJoinedCount = maxGroups <= 1 && displayJoinedCount > 0
  let actionButtonMode = 'create'
  let actionButtonText = '立即开团'
  let actionButtonDisabled = false

  if (activeGroup && activeGroup.status === 'success' && !canCreateGroup) {
    actionButtonMode = 'completed'
    actionButtonText = '已成团'
    actionButtonDisabled = true
  } else if (isUserJoined) {
    actionButtonMode = 'joined'
    actionButtonText = '已参团，等待成团'
    actionButtonDisabled = true
  } else if (hasJoinableGroup) {
    actionButtonMode = 'join'
    actionButtonText = '去参团'
  } else if (canCreateGroup) {
    actionButtonMode = 'create'
    actionButtonText = '立即开团'
  } else {
    actionButtonMode = 'full'
    actionButtonText = '课程已满员，暂不可开团'
    actionButtonDisabled = true
  }

  return {
    activeGroup,
    hasActiveGroup,
    groupTargetCount,
    groupCurrentCount,
    displayJoinedCount,
    showJoinedCount,
    courseGroupList: (courseDetail && courseDetail.groupList) || [],
    actionButtonMode,
    actionButtonText,
    actionButtonDisabled,
    emptyGroupText:
      activeGroup && activeGroup.status === 'success' && !canCreateGroup
        ? '当前拼团已成团'
        : activeGroup && activeGroup.status === 'failed'
          ? canCreateGroup
            ? '当前拼团已结束，可重新开团'
            : '该课程已达开团上限'
          : canCreateGroup
            ? '暂无进行中的拼团，立即开团吧'
            : '该课程已达开团上限'
  }
}

const buildSharePayload = ({ activeGroup, courseDetail, courseId, sharedGroupId }) => {
  const targetGroupId = (activeGroup && activeGroup.groupId) || sharedGroupId || ''

  if (!targetGroupId || !courseDetail || !courseId) {
    return {
      title: '邻动体适能拼团',
      path: '/pages/home/index',
      success() {
        wx.showToast({ title: '分享成功', icon: 'success', duration: 2000 })
      }
    }
  }

  return {
    title: `邀请你加入「${courseDetail.title}」拼团`,
    path: `/pages/course/detail/index?id=${courseId}&groupId=${targetGroupId}`,
    imageUrl: (courseDetail.images && courseDetail.images[0]) || '',
    success() {
      wx.showToast({ title: '分享成功', icon: 'success', duration: 2000 })
    }
  }
}

module.exports = {
  buildActiveGroupViewModel,
  buildGroupPresentationState,
  buildSharePayload,
  normalizeCourseDetail
}
