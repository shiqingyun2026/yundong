const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const startJsPath = path.resolve(__dirname, '..', 'pages/package/start/index.js')
const packageUtilsPath = path.resolve(__dirname, '..', 'utils/package.js')

test('trial package start page submits classDate for trial orders', () => {
  const startSource = fs.readFileSync(startJsPath, 'utf8')
  const utilsSource = fs.readFileSync(packageUtilsPath, 'utf8')

  assert.match(startSource, /this\.data\.isTrialPackage[\s\S]*classDate:\s*this\.data\.selectedClassDate/)
  assert.match(utilsSource, /classDate/)
  assert.match(utilsSource, /\/api\/package-orders\/start/)
})
