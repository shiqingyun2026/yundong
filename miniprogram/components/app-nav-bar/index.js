Component({
  options: {
    multipleSlots: true
  },
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    background: {
      type: String,
      value: '#f7f8fa'
    },
    color: {
      type: String,
      value: '#1f2329'
    },
    back: {
      type: Boolean,
      value: false
    },
    loading: {
      type: Boolean,
      value: false
    },
    show: {
      type: Boolean,
      value: true
    },
    delta: {
      type: Number,
      value: 1
    }
  },
  methods: {
    handleBack() {
      if (this.data.delta) {
        wx.navigateBack({
          delta: this.data.delta,
          fail: () => {}
        })
      }
      this.triggerEvent(
        'back',
        {
          delta: this.data.delta
        },
        {}
      )
    }
  }
})
