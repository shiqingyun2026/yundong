const { resolveRuntimeInfo } = require('../../utils/util')

Component({
  options: {
    multipleSlots: true
  },
  properties: {
    extClass: {
      type: String,
      value: ''
    },
    title: {
      type: String,
      value: ''
    },
    background: {
      type: String,
      value: ''
    },
    color: {
      type: String,
      value: ''
    },
    loading: {
      type: Boolean,
      value: false
    },
    animated: {
      type: Boolean,
      value: true
    },
    show: {
      type: Boolean,
      value: true,
      observer: '_showChange'
    }
  },
  data: {
    ios: false,
    statusBarHeight: 20,
    navBarHeight: 64,
    navBarBodyHeight: 44,
    displayStyle: '',
    innerWidth: '',
    innerPaddingRight: '',
    leftWidth: ''
  },
  lifetimes: {
    attached() {
      this.syncLayout()
      this._showChange(this.data.show)
    }
  },
  methods: {
    syncLayout() {
      const runtime = resolveRuntimeInfo()
      const menuButtonRect = runtime.menuButtonRect || {}
      const menuButtonLeft = Number(menuButtonRect.left) || runtime.windowWidth

      this.setData({
        ios: !!runtime.ios,
        statusBarHeight: runtime.statusBarHeight || 20,
        navBarHeight: runtime.navBarHeight || 64,
        navBarBodyHeight: runtime.navBarBodyHeight || 44,
        innerWidth: runtime.windowWidth ? `width:${runtime.windowWidth}px;` : '',
        innerPaddingRight:
          runtime.windowWidth && menuButtonLeft
            ? `padding-right:${Math.max(runtime.windowWidth - menuButtonLeft, 0)}px;`
            : '',
        leftWidth:
          runtime.windowWidth && menuButtonLeft ? `width:${Math.max(runtime.windowWidth - menuButtonLeft, 0)}px;` : ''
      })
    },
    _showChange(show) {
      const displayStyle = this.data.animated
        ? `opacity:${show ? '1' : '0'};-webkit-transition:opacity 0.5s;transition:opacity 0.5s;`
        : `display:${show ? '' : 'none'};`

      this.setData({
        displayStyle
      })
    }
  }
})
