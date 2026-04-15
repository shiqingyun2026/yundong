const {
  BRAND_PRIMARY,
  BRAND_PRIMARY_STRONG
} = require('../../config/theme')

const pageIcons = [
  { name: 'nav-back-dark', icon: 'back', type: 'outline', color: '#1f2329' },
  { name: 'nav-forward-muted', icon: 'arrow', type: 'outline', color: '#b6bdc8' },
  { name: 'nav-forward-light', icon: 'arrow', type: 'outline', color: '#c0c7d2' },
  { name: 'status-success', icon: 'done', type: 'filled', color: '#1f9d63' },
  { name: 'checkbox-tick-inverse', icon: 'done', type: 'filled', color: '#ffffff' },
  { name: 'status-fail', icon: 'close', type: 'filled', color: '#ff4d4f' },
  { name: 'action-clear-muted', icon: 'close', type: 'outline', color: '#98a2b3' },
  { name: 'support-primary', icon: 'contacts', type: 'filled', color: BRAND_PRIMARY },
  { name: 'location-primary', icon: 'location', type: 'filled', color: BRAND_PRIMARY },
  { name: 'location-green', icon: 'location', type: 'filled', color: '#10b981' },
  { name: 'location-warm', icon: 'location', type: 'filled', color: '#ff7a45' },
  { name: 'location-violet', icon: 'location', type: 'filled', color: '#8b5cf6' },
  { name: 'location-inverse', icon: 'location', type: 'filled', color: '#ffffff' },
  { name: 'status-loading-primary', icon: 'refresh', type: 'outline', color: BRAND_PRIMARY },
  { name: 'status-loading-muted', icon: 'refresh', type: 'outline', color: '#8f96a3' },
  { name: 'search-muted', icon: 'search', type: 'outline', color: '#98a2b3' },
  { name: 'highlight-bolt-primary', icon: 'discover', type: 'filled', color: BRAND_PRIMARY_STRONG },
  { name: 'avatar-user-inverse', icon: 'me', type: 'filled', color: '#ffffff' },
  { name: 'status-info-primary', icon: 'info', type: 'filled', color: BRAND_PRIMARY }
]

const tabbarIcons = [
  { name: 'home', icon: 'home', type: 'filled', color: '#8f96a3', size: 81 },
  { name: 'home-active', icon: 'home', type: 'filled', color: BRAND_PRIMARY, size: 81 },
  { name: 'mine', icon: 'me', type: 'filled', color: '#8f96a3', size: 81 },
  { name: 'mine-active', icon: 'me', type: 'filled', color: BRAND_PRIMARY, size: 81 }
]

module.exports = {
  pageIcons,
  tabbarIcons
}
