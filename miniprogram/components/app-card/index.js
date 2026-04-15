Component({
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    hoverClass: {
      type: String,
      value: ''
    },
    shadow: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap(event) {
      this.triggerEvent('tap', event.detail || {}, { bubbles: true, composed: true })
    }
  }
})
