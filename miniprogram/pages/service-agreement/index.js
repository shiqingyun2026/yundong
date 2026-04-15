const { getCourseServiceAgreementNodes } = require('../../utils/agreement')

Page({
  data: {
    contentNodes: []
  },

  onLoad() {
    this.setData({
      contentNodes: getCourseServiceAgreementNodes()
    })
  }
})
