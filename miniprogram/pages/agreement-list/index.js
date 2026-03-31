const { AGREEMENT_DOCS } = require('../../utils/agreement')

Page({
  data: {
    agreementList: AGREEMENT_DOCS.filter(item => item.key !== 'course-service').map(item => ({
      key: item.key,
      title: item.title
    }))
  },

  handleOpenAgreement(event) {
    const { key } = event.currentTarget.dataset

    if (!key) {
      return
    }

    wx.navigateTo({
      url: `/pages/agreement-content/index?key=${key}`
    })
  }
})
