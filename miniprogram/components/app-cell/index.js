Component({
  options: {
    multipleSlots: true,
    virtualHost: true
  },
  properties: {
    hover: {
      type: Boolean,
      value: false
    },
    link: {
      type: Boolean,
      value: false
    },
    extClass: {
      type: String,
      value: ''
    },
    iconClass: {
      type: String,
      value: ''
    },
    bodyClass: {
      type: String,
      value: ''
    },
    icon: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    value: {
      type: String,
      value: ''
    },
    showError: {
      type: Boolean,
      value: false
    },
    url: {
      type: String,
      value: ''
    },
    footerClass: {
      type: String,
      value: ''
    },
    footer: {
      type: String,
      value: ''
    },
    inline: {
      type: Boolean,
      value: true
    },
    hasHeader: {
      type: Boolean,
      value: true
    },
    hasFooter: {
      type: Boolean,
      value: true
    },
    hasBody: {
      type: Boolean,
      value: true
    },
    extHoverClass: {
      type: String,
      value: ''
    },
    ariaRole: {
      type: String,
      value: ''
    }
  },
  methods: {
    handleTap() {
      this.triggerEvent('tap')
    }
  }
})
