const { fetchPackageGroupDetail } = require('../../../utils/package')
const { loginAndStoreSession } = require('../../../utils/auth')
const {
  requestGroupResultSubscription,
  reportGroupResultSubscription,
  resolveGroupResultTemplateIds
} = require('../../../utils/notification')

const STATUS_MAP = {
  active: {
    text: '进行中',
    className: 'status-ongoing'
  },
  success: {
    text: '已成团',
    className: 'status-success'
  },
  failed: {
    text: '已失败',
    className: 'status-failed'
  }
}

Page({
  data: {
    packageGroupId: '',
    packageId: '',
    entry: '',
    source: '',
    action: 'start',
    successType: '',
    selectedChildNickname: '',
    selectedChildAge: '',
    loading: true,
    groupDetail: null,
    statusText: '',
    statusClassName: '',
    bottomStatusText: '拼团失败，已退款',
    showSuccessEntry: false,
    successEntryTitle: '',
    successSummaryText: '',
    missingCount: 0,
    primaryActionText: '邀请好友参团',
    showPrimaryShareAction: false,
    showJoinAction: false,
    showSubscribeCard: false,
    subscribeEnabled: false,
    subscribeSubmitting: false,
    subscribeStatusText: '',
    subscribeStatusTone: 'muted',
    subscribed: false
  },

  async onLoad(options) {
    this._isAlive = true
    this.setData({
      packageGroupId: options.packageGroupId || options.groupId || '',
      packageId: options.packageId || '',
      entry: options.entry || '',
      source: options.source || '',
      action: options.action || 'start',
      successType: options.successType || '',
      selectedChildNickname: decodeURIComponent(options.selectedChildNickname || ''),
      selectedChildAge: decodeURIComponent(options.selectedChildAge || ''),
      showSuccessEntry: options.entry === 'paymentSuccess',
      subscribeEnabled: this.resolveSubscribeEnabled()
    })

    await this.ensureLogin()
    await this.loadGroupDetail(this.data.packageGroupId)
  },

  async onShow() {
    if (!this.data.packageGroupId) {
      return
    }

    await this.loadGroupDetail(this.data.packageGroupId)
  },

  onUnload() {
    this._isAlive = false
  },

  safeSetData(payload) {
    if (!this._isAlive) {
      return
    }

    this.setData(payload)
  },

  async ensureLogin() {
    if (wx.getStorageSync('token')) {
      return true
    }

    try {
      await loginAndStoreSession()
      return true
    } catch (error) {
      return false
    }
  },

  updateGroupPresentation(groupDetail) {
    const statusInfo = STATUS_MAP[groupDetail.status] || STATUS_MAP.active
    const missingCount = Math.max(0, (groupDetail.targetCount || 0) - (groupDetail.currentCount || 0))
    const isPaymentSuccessEntry = this.data.entry === 'paymentSuccess'
    const isShareEntry = this.data.entry === 'share'
    const isActive = groupDetail.status === 'active'
    const showSuccessEntry = isPaymentSuccessEntry
    const showSubscribeCard = isPaymentSuccessEntry && isActive
    const successSummaryText = isPaymentSuccessEntry ? this.resolveSuccessSummaryText(groupDetail, missingCount) : ''
    const showPrimaryShareAction = isActive && !!groupDetail.userJoined && !isShareEntry
    const showJoinAction = isActive && (!groupDetail.userJoined || isShareEntry)
    const normalizedSelectedAge =
      this.data.selectedChildAge === '' || this.data.selectedChildAge === null || this.data.selectedChildAge === undefined
        ? null
        : Number(this.data.selectedChildAge) || 0
    const members = Array.isArray(groupDetail.members)
      ? groupDetail.members.map(member => ({
          ...member,
          isCurrentOrderChild:
            this.data.source === 'myGroupList' &&
            !!this.data.selectedChildNickname &&
            (member.displayName || member.child_nickname || member.nickname || '') === this.data.selectedChildNickname &&
            (normalizedSelectedAge === null || Number(member.childAge) === normalizedSelectedAge)
        }))
      : []

    this.safeSetData({
      groupDetail: {
        ...groupDetail,
        members
      },
      statusText: statusInfo.text,
      statusClassName: statusInfo.className,
      showSuccessEntry,
      successEntryTitle: showSuccessEntry ? this.resolveSuccessEntryTitle() : '',
      successSummaryText,
      missingCount,
      showSubscribeCard,
      primaryActionText: showPrimaryShareAction ? '邀请好友参团' : showJoinAction ? '立即参团' : '',
      showPrimaryShareAction,
      showJoinAction,
      bottomStatusText:
        groupDetail.status === 'success'
          ? '已成团，等待上课'
          : groupDetail.status === 'failed'
            ? '拼团失败，已退款'
            : '邀请好友一起参团'
    })
  },

  resolveSubscribeEnabled() {
    const templateIds = resolveGroupResultTemplateIds()
    return !!(templateIds.groupSuccess && templateIds.groupFail && wx.requestSubscribeMessage)
  },

  resolveSuccessSummaryText(groupDetail, missingCount) {
    if (!groupDetail || groupDetail.status === 'success') {
      return '已成团'
    }

    if (groupDetail.status === 'failed') {
      return '拼团失败'
    }

    const prefix = this.data.action === 'join' ? '已参团' : '已开团'
    return missingCount > 0 ? `${prefix} · 还差${missingCount}人成团` : `${prefix} · 即将成团`
  },

  resolveSuccessEntryTitle() {
    return this.data.successType === 'join' ? '参团成功' : '开团成功'
  },

  async loadGroupDetail(packageGroupId) {
    if (!packageGroupId) {
      wx.showToast({
        title: '拼团信息不存在',
        icon: 'none'
      })
      return
    }

    this.safeSetData({
      loading: true
    })

    try {
      const groupDetail = await fetchPackageGroupDetail(packageGroupId)
      this.updateGroupPresentation(groupDetail)
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '拼团详情加载失败',
        icon: 'none'
      })
    } finally {
      this.safeSetData({
        loading: false
      })
    }
  },

  onShareAppMessage() {
    const { groupDetail } = this.data
    if (!groupDetail) {
      return {
        title: '邻动体适能课程拼团',
        path: '/pages/home/index'
      }
    }

    return {
      title:
        groupDetail.status === 'active'
          ? `还差${Math.max(0, groupDetail.targetCount - groupDetail.currentCount)}人，来拼「${groupDetail.packageInfo.name}」`
          : `邀请你查看「${groupDetail.packageInfo.name}」拼团详情`,
      path:
        `/pages/group/detail/index?packageGroupId=${encodeURIComponent(groupDetail.id)}` +
        `&packageId=${encodeURIComponent(groupDetail.packageInfo.id || '')}` +
        `&entry=share&action=join`,
      imageUrl: ''
    }
  },

  async handleSubscribeTap() {
    if (!this.data.showSubscribeCard || !this.data.subscribeEnabled || this.data.subscribeSubmitting || this.data.subscribed) {
      return
    }

    this.safeSetData({
      subscribeSubmitting: true,
      subscribeStatusText: '正在发起订阅...',
      subscribeStatusTone: 'muted'
    })

    try {
      const payload = await requestGroupResultSubscription({
        groupId: this.data.packageGroupId,
        courseId: this.data.packageId || (this.data.groupDetail && this.data.groupDetail.packageInfo.id) || ''
      })

      try {
        await reportGroupResultSubscription(payload)
      } catch (reportError) {
        console.warn('[group/detail] report subscribe result failed', reportError)
      }

      if (payload.ok) {
        this.safeSetData({
          subscribed: true,
          subscribeStatusText: '订阅成功，后续会通过微信通知你拼团结果。',
          subscribeStatusTone: 'success'
        })
        return
      }

      if (payload.skipped) {
        this.safeSetData({
          subscribeStatusText:
            payload.reason === 'template_not_configured'
              ? '通知模板暂未配置完成，请在“我的拼团”里留意结果。'
              : '当前微信版本不支持订阅通知，请在“我的拼团”里留意结果。',
          subscribeStatusTone: 'muted'
        })
        return
      }

      this.safeSetData({
        subscribeStatusText: '你暂未订阅通知，后续可在“我的拼团”里查看拼团状态。',
        subscribeStatusTone: 'muted'
      })
    } finally {
      this.safeSetData({
        subscribeSubmitting: false
      })
    }
  },

  handlePreviewCertificate(event) {
    const url = event.currentTarget.dataset.url
    const certificates =
      (this.data.groupDetail &&
        this.data.groupDetail.packageInfo &&
        this.data.groupDetail.packageInfo.coachCertificates) ||
      []

    if (!url || !certificates.length) {
      return
    }

    wx.previewImage({
      urls: certificates,
      current: url
    })
  },

  handleJoinGroup() {
    const { groupDetail } = this.data
    if (!groupDetail || groupDetail.status !== 'active') {
      return
    }

    wx.navigateTo({
      url: `/pages/payment/confirm/index?action=join&packageId=${groupDetail.packageInfo.id}&packageGroupId=${groupDetail.id}`
    })
  }
})
