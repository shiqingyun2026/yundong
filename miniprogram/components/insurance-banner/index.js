Component({
  options: {
    addGlobalClass: true
  },

  methods: {
    handleTap() {
      wx.navigateTo({
        url: '/pages/insurance/intro/index'
      })
    }
  }
})
