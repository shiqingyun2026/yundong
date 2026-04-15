Component({
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    show: {
      type: Boolean,
      value: true
    },
    type: {
      type: String,
      value: 'dot-gray'
    },
    tips: {
      type: String,
      value: '加载中...'
    },
    animated: {
      type: Boolean,
      value: true
    },
    duration: {
      type: Number,
      value: 350
    }
  },
  data: {
    usePrimary: false,
    resolvedType: 'dot-gray'
  },
  lifetimes: {
    attached() {
      this.syncType(this.data.type)
    }
  },
  observers: {
    type(type) {
      this.syncType(type)
    }
  },
  methods: {
    syncType(type) {
      const nextType = type === 'circle' || type === 'dot-white' || type === 'dot-gray' ? type : 'dot-gray'
      this.setData({
        usePrimary: type === 'primary',
        resolvedType: nextType
      })
    }
  }
})
