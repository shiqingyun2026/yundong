const buildButtons = ({ showCancel, cancelText, confirmText }) => {
  const buttons = []

  if (showCancel) {
    buttons.push({
      text: cancelText,
      extClass: 'app-dialog-button-cancel'
    })
  }

  buttons.push({
    text: confirmText,
    extClass: 'app-dialog-button-confirm'
  })

  return buttons
}

Component({
  options: {
    multipleSlots: true
  },
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
    },
    extClass: {
      type: String,
      value: ''
    },
    mask: {
      type: Boolean,
      value: true
    },
    maskClosable: {
      type: Boolean,
      value: true
    }
  },
  data: {
    dialogButtons: []
  },
  observers: {
    'showCancel,cancelText,confirmText': function observer(showCancel, cancelText, confirmText) {
      this.setData({
        dialogButtons: buildButtons({
          showCancel,
          cancelText,
          confirmText
        })
      })
    }
  },
  lifetimes: {
    attached() {
      this.setData({
        dialogButtons: buildButtons(this.data)
      })
    }
  },
  methods: {
    handleClose() {
      this.triggerEvent('close')
    },
    handleButtonTap(event) {
      const { index } = event.detail || {}

      if (this.data.showCancel && index === 0) {
        this.triggerEvent('cancel')
        return
      }

      this.triggerEvent('confirm')
    }
  }
})
