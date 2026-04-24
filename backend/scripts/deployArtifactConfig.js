const path = require('path')

const backendRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(backendRoot, '..')
const deployRoot = path.join(projectRoot, 'deploy-artifacts', 'lindong-api-deploy')

const includedDirectories = [
  'config',
  'lib',
  'middleware',
  'miniprogram-container',
  'repositories',
  'routes',
  'shared',
  'utils'
]

const includedFiles = [
  '.dockerignore',
  '.gitignore',
  'Dockerfile',
  'app.js',
  'package-lock.json',
  'package.json',
  'server.js',
  'vercel.json',
  'worker.mjs',
  'wrangler.jsonc'
]

module.exports = {
  backendRoot,
  deployRoot,
  includedDirectories,
  includedFiles
}
