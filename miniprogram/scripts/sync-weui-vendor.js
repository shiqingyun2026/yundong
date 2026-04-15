const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const sourceDir = path.join(projectRoot, 'node_modules', 'weui-miniprogram', 'miniprogram_dist')
const targetDir = path.join(projectRoot, 'vendor', 'weui-miniprogram')

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Missing WeUI source directory: ${sourceDir}`)
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true })
fs.rmSync(targetDir, { recursive: true, force: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Synced WeUI vendor assets to ${targetDir}`)
