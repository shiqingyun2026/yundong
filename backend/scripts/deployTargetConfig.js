const path = require('path')

const backendRoot = path.resolve(__dirname, '..')
const baseIncludedDirectories = [
  'config',
  'lib',
  'middleware',
  'repositories',
  'shared',
  'utils'
]

const deployTargets = {
  lindongApiService: {
    label: 'backend/lindong-api',
    targetRoot: path.join(backendRoot, 'lindong-api'),
    includedDirectories: [...baseIncludedDirectories, 'miniprogram-container', 'routes'],
    includedFiles: [
      '.dockerignore',
      '.gitignore',
      'Dockerfile',
      'README.lindong-api.md',
      'app.js',
      'package-lock.json',
      'package.json',
      'server.js',
      'vercel.json',
      'worker.mjs',
      'wrangler.jsonc'
    ],
    renameFiles: {
      'README.lindong-api.md': 'README.md'
    },
    excludedFiles: [
      'shared/services/bannerState.js'
    ]
  },
  consoleApiService: {
    label: 'backend/console-api-service',
    targetRoot: path.join(backendRoot, 'console-api-service'),
    includedDirectories: [...baseIncludedDirectories, 'console-api', 'data'],
    includedFiles: [
      '.dockerignore',
      '.gitignore',
      'Dockerfile',
      'package-lock.json',
      'package.json'
    ],
    excludedFiles: [
      'shared/services/cosSignedUrl.js'
    ]
  }
}

module.exports = {
  backendRoot,
  deployTargets
}
