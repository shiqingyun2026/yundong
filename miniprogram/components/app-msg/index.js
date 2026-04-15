const iconRegistry = require('../app-icon/registry')

const TYPE_PRESETS = {
  success: {
    type: 'success'
  },
  error: {
    type: 'cancel'
  },
  fail: {
    type: 'cancel'
  },
  warn: {
    type: 'warn'
  },
  loading: {
    icon: (iconRegistry['status-loading-primary'] && iconRegistry['status-loading-primary'].src) || ''
  },
  info: {
    type: 'info'
  }
}

Component({
  options: {
    multipleSlots: true
  },
  properties: {
    title: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: ''
    },
    icon: {
      type: String,
      value: ''
    },
    desc: {
      type: String,
      value: ''
    },
    extClass: {
      type: String,
      value: ''
    },
    size: {
      type: Number,
      value: 64
    }
  },
  data: {
    resolvedType: '',
    resolvedIcon: ''
  },
  lifetimes: {
    attached() {
      this.syncProps(this.data.type, this.data.icon)
    }
  },
  observers: {
    'type, icon'(type, icon) {
      this.syncProps(type, icon)
    }
  },
  methods: {
    syncProps(type, icon) {
      const preset = TYPE_PRESETS[type] || null

      this.setData({
        resolvedType: icon ? '' : (preset && preset.type) || type || '',
        resolvedIcon: icon || (preset && preset.icon) || ''
      })
    }
  }
})
