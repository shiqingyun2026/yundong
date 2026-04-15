Component({
  options: {
    multipleSlots: true,
    virtualHost: true
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
    footer: {
      type: String,
      value: ''
    },
    ariaRole: {
      type: String,
      value: ''
    }
  }
})
