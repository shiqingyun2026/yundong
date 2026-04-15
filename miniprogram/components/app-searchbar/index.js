Component({
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    focus: {
      type: Boolean,
      value: false
    },
    placeholder: {
      type: String,
      value: '搜索'
    },
    value: {
      type: String,
      value: ''
    },
    cancel: {
      type: Boolean,
      value: true
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    confirmType: {
      type: String,
      value: 'search'
    }
  },
  methods: {
    handleInput(event) {
      this.triggerEvent('input', event.detail || {})
    },
    handleFocus(event) {
      this.triggerEvent('focus', event.detail || {})
    },
    handleBlur(event) {
      this.triggerEvent('blur', event.detail || {})
    },
    handleConfirm(event) {
      this.triggerEvent('confirm', event.detail || {})
    },
    handleClear(event) {
      this.triggerEvent('clear', event.detail || {})
    },
    handleCancel(event) {
      this.triggerEvent('cancel', event.detail || {})
    }
  }
})
