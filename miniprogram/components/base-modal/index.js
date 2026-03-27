Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '提示'
    },
    confirmText: {
      type: String,
      value: '确定'
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    showCancel: {
      type: Boolean,
      value: true
    }
  },
  methods: {
    noop() {},
    handleMaskTap() {
      this.triggerEvent('close')
    },
    handleCancel() {
      this.triggerEvent('cancel')
    },
    handleConfirm() {
      this.triggerEvent('confirm')
    }
  }
})
