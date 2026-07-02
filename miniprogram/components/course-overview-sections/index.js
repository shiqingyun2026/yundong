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
    detailLayoutVariant: {
      type: String,
      value: ''
    },
    showCourseInfoCard: {
      type: Boolean,
      value: true
    },
    showFeatureTags: {
      type: Boolean,
      value: true
    },
    showLocationInfo: {
      type: Boolean,
      value: true
    },
    extraInfoRows: {
      type: Array,
      value: []
    },
    showSupportedGroupPrices: {
      type: Boolean,
      value: true
    },
    showInsuranceBanner: {
      type: Boolean,
      value: true
    },
    showCourseContentSections: {
      type: Boolean,
      value: true
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
