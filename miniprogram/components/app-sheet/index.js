Component({
  options: {
    multipleSlots: true
  },
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    extClass: {
      type: String,
      value: ''
    },
    closable: {
      type: Boolean,
      value: false
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
  methods: {
    handleClose() {
      this.triggerEvent('close')
    },
    handleButtonTap(event) {
      this.triggerEvent('buttontap', event.detail || {})
    }
  }
})
