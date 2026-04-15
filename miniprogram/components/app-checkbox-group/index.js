Component({
  options: {
    multipleSlots: true
  },
  properties: {
    extClass: {
      type: String,
      value: ''
    }
  },
  data: {
    targetList: []
  },
  relations: {
    '../app-checkbox/index': {
      type: 'descendant',
      linked(target) {
        this.data.targetList.push(target)
      },
      unlinked(target) {
        const nextList = this.data.targetList.filter(item => item !== target)
        this.setData({
          targetList: nextList
        })
      }
    }
  },
  methods: {
    checkedChange() {
      const value = this.data.targetList
        .filter(target => !target.data.disabled && target.data.checked)
        .map(target => target.data.value)

      this.triggerEvent('change', { value })
    }
  }
})
