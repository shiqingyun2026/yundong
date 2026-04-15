Component({
  options: {
    multipleSlots: true
  },
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
      value: '',
      observer: 'valueChange'
    },
    cancelText: {
      type: String,
      value: '取消'
    },
    cancel: {
      type: Boolean,
      value: true
    },
    confirmType: {
      type: String,
      value: 'search'
    }
  },
  data: {
    searchState: false
  },
  lifetimes: {
    attached() {
      if (this.data.focus) {
        this.setData({
          searchState: true
        })
      }
    }
  },
  methods: {
    valueChange(nextValue) {
      if (`${nextValue || ''}`) {
        this.setData({
          searchState: true
        })
      }
    },
    clearInput() {
      this.triggerEvent('clear', {})
    },
    inputFocus(event) {
      this.setData({
        searchState: true
      })
      this.triggerEvent('focus', event.detail || {})
    },
    inputBlur(event) {
      this.triggerEvent('blur', event.detail || {})
    },
    showInput() {
      this.setData({
        searchState: true
      })
    },
    hideInput() {
      this.setData({
        searchState: false
      })
      this.triggerEvent('cancel', {})
    },
    inputChange(event) {
      this.triggerEvent('input', event.detail || {})
    },
    inputConfirm(event) {
      this.triggerEvent('confirm', event.detail || {})
    }
  }
})
