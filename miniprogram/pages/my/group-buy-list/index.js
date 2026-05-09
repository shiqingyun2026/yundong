const { fetchUserPackageGroupList } = require('../../../utils/package')

const TAB_LIST = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'success', label: '已成团' },
  { key: 'failed', label: '已失败' }
]

Page({
  data: {
    tabs: TAB_LIST,
    activeTab: 'all',
    groupList: [],
    loading: true,
    loadingMore: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    this.loadGroupList({ page: 1 })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) {
      return
    }

    this.loadGroupList({
      page: this.data.page + 1,
      append: true
    })
  },

  async onPullDownRefresh() {
    await this.loadGroupList({ page: 1 })
    wx.stopPullDownRefresh()
  },

  async loadGroupList({ page = 1, append = false } = {}) {
    const loadingKey = append ? 'loadingMore' : 'loading'
    this.setData({
      [loadingKey]: true
    })

    try {
      const result = await fetchUserPackageGroupList({
        status: this.data.activeTab,
        page,
        pageSize: this.data.pageSize
      })

      this.setData({
        groupList: append ? this.data.groupList.concat(result.list) : result.list,
        page,
        hasMore: result.hasMore
      })
    } catch (error) {
      wx.showToast({
        title: '拼团列表加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        loading: false,
        loadingMore: false
      })
    }
  },

  handleTabTap(event) {
    const key = (event.detail && event.detail.key) || (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.key)
    if (!key || key === this.data.activeTab) {
      return
    }

    this.setData({
      activeTab: key,
      page: 1,
      hasMore: true
    })

    this.loadGroupList({ page: 1 })
  },

  handleOpenDetail(event) {
    const { groupId, childNickname = '', childAge = '', canOpenDetail } = event.currentTarget.dataset
    const item = this.data.groupList.find(item => item.packageGroupId === groupId)
    if ((item && item.canOpenDetail === false) || canOpenDetail === false || canOpenDetail === 'false') {
      return
    }
    if (!groupId) {
      return
    }

    wx.navigateTo({
      url:
        `/pages/group/detail/index?packageGroupId=${groupId}` +
        `&source=myGroupList` +
        `&selectedChildNickname=${encodeURIComponent(childNickname)}` +
        `&selectedChildAge=${encodeURIComponent(childAge === null || childAge === undefined ? '' : `${childAge}`)}`
    })
  }
})
