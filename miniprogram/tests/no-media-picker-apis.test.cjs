const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const rootDir = path.resolve(__dirname, '..')
const blockedApis = ['wx.chooseImage', 'wx.chooseMedia', 'wx.chooseVideo']
const skippedDirs = new Set(['node_modules', 'tests'])

const walk = dir => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) {
        files.push(...walk(path.join(dir, entry.name)))
      }
      continue
    }

    if (/\.(js|wxml|json|wxss|cjs)$/.test(entry.name)) {
      files.push(path.join(dir, entry.name))
    }
  }

  return files
}

test('miniprogram bundle does not include media picker apis', () => {
  const files = walk(rootDir)
  const violations = []

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const api of blockedApis) {
      if (source.includes(api)) {
        violations.push(`${path.relative(rootDir, file)} -> ${api}`)
      }
    }
  }

  assert.deepEqual(violations, [])
})
