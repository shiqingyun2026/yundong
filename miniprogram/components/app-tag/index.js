Component({
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    text: {
      type: String,
      value: ''
    }
  },
  methods: {
    handleTap(event) {
      this.triggerEvent('tap', event.detail || {}, { bubbles: true, composed: true })
    }
  }
})
