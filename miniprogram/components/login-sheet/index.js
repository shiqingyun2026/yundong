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
    handleClose() {
      this.triggerEvent('close')
    },
    handleConfirm() {
      this.triggerEvent('confirm')
    },
    handleAgreementChange() {
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
