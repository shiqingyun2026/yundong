const { getAgreementDocByKey } = require('../../utils/agreement')

Page({
  data: {
    title: '',
    subtitle: '',
    contentNodes: []
  },

  onLoad(options) {
    const doc = getAgreementDocByKey((options && options.key) || 'user')

    wx.setNavigationBarTitle({
      title: doc.title
    })

    this.setData({
      title: doc.title,
      subtitle: doc.subtitle,
      contentNodes: doc.nodes
    })
  }
})
