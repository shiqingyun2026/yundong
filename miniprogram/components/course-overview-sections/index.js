Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'shared'
  },

  properties: {
    packageInfo: {
      type: Object,
      value: null
    },
    extraInfoRows: {
      type: Array,
      value: []
    }
  },

  methods: {
    handlePreviewCertificate(event) {
      const { url } = event.currentTarget.dataset
      const packageInfo = this.properties.packageInfo || {}
      const certificateList = Array.isArray(packageInfo.coachCertificates) ? packageInfo.coachCertificates : []

      if (!url || !certificateList.length) {
        return
      }

      wx.previewImage({
        current: url,
        urls: certificateList
      })
    }
  }
})
