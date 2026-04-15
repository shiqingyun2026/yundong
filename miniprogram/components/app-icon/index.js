const iconRegistry = require('./registry')

Component({
  options: {
    virtualHost: true,
    styleIsolation: 'apply-shared'
  },
  properties: {
    name: {
      type: String,
      value: ''
    },
    className: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    size: {
      type: Number,
      value: 0
    }
  },
  data: {
    src: '',
    styleText: ''
  },
  lifetimes: {
    attached() {
      this.syncIcon(this.data.name, this.data.color, this.data.size)
    }
  },
  observers: {
    'name, color, size': function () {
      this.syncIcon(this.data.name, this.data.color, this.data.size)
    }
  },
  methods: {
    syncIcon(name, color, size) {
      const icon = iconRegistry[name] || null
      const resolvedColor = color || (icon && icon.color) || '#000000'
      const sizeStyle = Number(size) > 0 ? `width:${size}px;height:${size}px;` : ''

      this.setData({
        src: icon ? icon.src : '',
        styleText: icon
          ? `background:${resolvedColor};mask-image:url(${icon.src});-webkit-mask-image:url(${icon.src});-moz-mask-image:url(${icon.src});${sizeStyle}`
          : ''
      })
    }
  }
})
