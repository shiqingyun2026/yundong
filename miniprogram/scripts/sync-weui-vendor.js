const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const sourceDir = path.join(projectRoot, 'node_modules', 'weui-miniprogram', 'miniprogram_dist')
const targetDir = path.join(projectRoot, 'vendor', 'weui-miniprogram')
const sourceAssetsDir = path.join(sourceDir, '_assets')
const targetAssetsDir = path.join(projectRoot, '_assets')

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Missing WeUI source directory: ${sourceDir}`)
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.rmSync(targetDir, { recursive: true, force: true })
fs.cpSync(sourceDir, targetDir, { recursive: true, force: true })

if (fs.existsSync(sourceAssetsDir)) {
  fs.mkdirSync(targetAssetsDir, { recursive: true })
  fs.cpSync(sourceAssetsDir, targetAssetsDir, { recursive: true, force: true })
}

console.log(`Synced WeUI vendor assets to ${targetDir}`)
if (fs.existsSync(sourceAssetsDir)) {
  console.log(`Synced WeUI root assets to ${targetAssetsDir}`)
}
