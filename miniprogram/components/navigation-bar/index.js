const { resolveRuntimeInfo } = require('../../utils/util')

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true,
    styleIsolation: 'shared'
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
    back: {
      type: Boolean,
      value: true
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
    },
    delta: {
      type: Number,
      value: 1
    }
  },

  data: {
    displayStyle: '',
    ios: false,
    placeholderStyle: '',
    innerLayoutStyle: '',
    innerWidth: '',
    innerPaddingRight: '',
    leftWidth: ''
  },

  lifetimes: {
    attached() {
      this._setupLayout()
      this._showChange(this.data.show)
    }
  },

  methods: {
    _setupLayout() {
      const app = typeof getApp === 'function' ? getApp() : null
      const runtimeInfo =
        (app && app.globalData && app.globalData.systemInfo) || resolveRuntimeInfo()
      const statusBarHeight = Number(runtimeInfo.statusBarHeight) || 20
      const navBarBodyHeight = Number(runtimeInfo.navBarBodyHeight) || 44
      const navBarHeight = Number(runtimeInfo.navBarHeight) || statusBarHeight + navBarBodyHeight
      const windowWidth = Number(runtimeInfo.windowWidth) || 375
      const menuButtonRect = runtimeInfo.menuButtonRect || null
      const rightReservedWidth =
        menuButtonRect && Number.isFinite(Number(menuButtonRect.left))
          ? Math.max(windowWidth - Number(menuButtonRect.left), 0)
          : 96

      this.setData({
        ios: !!runtimeInfo.ios,
        placeholderStyle: `height:${navBarHeight}px;`,
        innerLayoutStyle: `top:${statusBarHeight}px;height:${navBarBodyHeight}px;`,
        innerWidth: `width:${windowWidth}px;`,
        innerPaddingRight: `padding-right:${rightReservedWidth}px;`,
        leftWidth: `width:${rightReservedWidth}px;`
      })
    },

    _showChange(show) {
      const displayStyle = this.data.animated
        ? `opacity: ${show ? '1' : '0'}; -webkit-transition: opacity 0.5s; transition: opacity 0.5s;`
        : `display: ${show ? '' : 'none'}`

      this.setData({
        displayStyle
      })
    },

    back() {
      const { delta } = this.data
      if (delta) {
        wx.navigateBack({ delta })
      }
      this.triggerEvent(
        'back',
        {
          delta
        },
        {}
      )
    }
  }
})
