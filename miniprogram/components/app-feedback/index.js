Component({
  data: {
    visible: false,
    message: '',
    type: 'error',
    delay: 2000
  },
  lifetimes: {
    detached() {
      this.clearTimers()
    }
  },
  methods: {
    clearTimers() {
      if (this._showTimer) {
        clearTimeout(this._showTimer)
        this._showTimer = null
      }
    },
    resolveType(icon) {
      if (icon === 'success') {
        return 'success'
      }

      if (icon === 'loading') {
        return 'info'
      }

      return 'error'
    },
    showToast(options = {}) {
      const title = `${options.title || options.msg || ''}`.trim()
      if (!title) {
        return
      }

      const duration = typeof options.duration === 'number' ? options.duration : 2000
      const type = this.resolveType(options.icon || 'none')

      this.clearTimers()
      this.setData(
        {
          visible: false,
          message: title,
          type,
          delay: duration
        },
        () => {
          this._showTimer = setTimeout(() => {
            this._showTimer = null
            this.setData({
              visible: true
            })
            if (typeof options.success === 'function') {
              options.success({ errMsg: 'showToast:ok' })
            }
            if (typeof options.complete === 'function') {
              options.complete({ errMsg: 'showToast:ok' })
            }
          }, 16)
        }
      )
    },
    handleHide() {
      this.setData({
        visible: false
      })
    }
  }
})
