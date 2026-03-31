Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    loading: {
      type: Boolean,
      value: false
    },
    agreementChecked: {
      type: Boolean,
      value: true
    }
  },
  methods: {
    noop() {},
    handleMaskTap() {
      this.triggerEvent('close')
    },
    handleClose() {
      this.triggerEvent('close')
    },
    handleConfirm() {
      this.triggerEvent('confirm')
    },
    handleToggleAgreement() {
      this.triggerEvent('toggleagreement')
    },
    handleOpenAgreement() {
      this.triggerEvent('openagreement')
    },
    handleOpenPrivacy() {
      this.triggerEvent('openprivacy')
    }
  }
})
