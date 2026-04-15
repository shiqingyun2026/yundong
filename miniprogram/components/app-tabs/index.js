Component({
  properties: {
    items: {
      type: Array,
      value: []
    },
    activeKey: {
      type: String,
      value: ''
    },
    extClass: {
      type: String,
      value: ''
    },
    itemClassName: {
      type: String,
      value: ''
    },
    activeItemClassName: {
      type: String,
      value: ''
    },
    wrap: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap(event) {
      const { index, key } = event.currentTarget.dataset
      const item = (this.data.items || [])[index]
      if (!item || key === this.data.activeKey) {
        return
      }

      this.triggerEvent(
        'change',
        {
          index,
          key,
          item
        },
        { bubbles: true, composed: true }
      )
    }
  }
})
