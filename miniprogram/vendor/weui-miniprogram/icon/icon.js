const ICONS = {
  arrow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 24"><path fill="#000" d="M3.2 4.2 2 5.4 7.6 12 2 18.6l1.2 1.2L10 12z"/></svg>',
  back: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 24"><path fill="#000" d="M8.8 4.2 10 5.4 4.4 12l5.6 6.6-1.2 1.2L2 12z"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="m13.2 12 5.4-5.4-1.2-1.2-5.4 5.4-5.4-5.4-1.2 1.2 5.4 5.4-5.4 5.4 1.2 1.2 5.4-5.4 5.4 5.4 1.2-1.2z"/></svg>',
  contacts: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M12 12.4a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 1.8c-4.4 0-8 2.2-8 5v.8h16v-.8c0-2.8-3.6-5-8-5Z"/></svg>',
  done: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M9.6 16.8 4.8 12l-1.4 1.4 6.2 6.2L21 8.2l-1.4-1.4z"/></svg>',
  location: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.8A2.8 2.8 0 1 1 12 6a2.8 2.8 0 0 1 0 5.6Z"/></svg>',
  me: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.4-8 5.3V21h16v-1.7c0-2.9-3.6-5.3-8-5.3Z"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#000" d="M17.7 6.3A8 8 0 0 0 4 12h2a6 6 0 0 1 10.2-4.2L13 11h8V3Zm.3 5.7a6 6 0 0 1-10.2 4.2L11 13H3v8l3.3-3.3A8 8 0 0 0 20 12Z"/></svg>'
}

const specialIconHeight = icon => (icon === 'arrow' || icon === 'back' ? 2 : 1)

const toDataUri = svg => `data:image/svg+xml,${encodeURIComponent(svg)}`

Component({
  properties: {
    extClass: { type: String, value: '' },
    type: { type: String, value: 'outline' },
    icon: { type: String, value: '', observer: '_genSrcByIcon' },
    size: { type: Number, value: 20 },
    color: { type: String, value: '#000000' }
  },
  data: {
    src: '',
    height: 20,
    width: 20
  },
  methods: {
    _genSrcByIcon(icon) {
      const svg = ICONS[icon]
      this.setData({
        src: svg ? toDataUri(svg) : '',
        height: this.data.size * specialIconHeight(icon),
        width: this.data.size
      })
    }
  }
})
