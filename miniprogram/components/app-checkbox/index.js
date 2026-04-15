const { BRAND_PRIMARY } = require('../../config/theme')

Component({
  options: {
    multipleSlots: true
  },
  properties: {
    value: {
      type: String,
      value: ''
    },
    checked: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    extClass: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: BRAND_PRIMARY
    }
  },
  relations: {
    '../app-checkbox-group/index': {
      type: 'ancestor',
      linked(target) {
        this.data.group = target
      },
      unlinked() {
        this.data.group = null
      }
    }
  },
  methods: {
    checkedChange() {
      if (this.data.disabled) {
        return
      }

      const nextChecked = !this.data.checked
      this.setData({
        checked: nextChecked
      })

      if (this.data.group) {
        this.data.group.checkedChange()
      }

      this.triggerEvent('change', {
        value: this.data.value,
        checked: nextChecked
      })
    }
  }
})
