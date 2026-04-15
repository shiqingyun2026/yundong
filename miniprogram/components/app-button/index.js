Component({
  options: {
    multipleSlots: true,
    virtualHost: true
  },
  properties: {
    text: {
      type: String,
      value: ''
    },
    extClass: {
      type: String,
      value: ''
    },
    variant: {
      type: String,
      value: 'primary'
    },
    size: {
      type: String,
      value: 'large'
    },
    block: {
      type: Boolean,
      value: true
    },
    loading: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    openType: {
      type: String,
      value: ''
    },
    formType: {
      type: String,
      value: ''
    },
    hoverClass: {
      type: String,
      value: 'weui-btn_hover'
    },
    lang: {
      type: String,
      value: 'zh_CN'
    },
    sessionFrom: {
      type: String,
      value: ''
    },
    sendMessageTitle: {
      type: String,
      value: ''
    },
    sendMessagePath: {
      type: String,
      value: ''
    },
    sendMessageImg: {
      type: String,
      value: ''
    },
    showMessageCard: {
      type: Boolean,
      value: false
    },
    appParameter: {
      type: String,
      value: ''
    }
  },
  methods: {
    handleTap(event) {
      this.triggerEvent('tap', event.detail || {}, { bubbles: true, composed: true })
    },
    forwardEvent(event) {
      this.triggerEvent(event.type, event.detail || {}, { bubbles: true, composed: true })
    }
  }
})
