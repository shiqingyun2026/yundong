const fs = require('fs')
const path = require('path')

const backendRoot = path.resolve(__dirname, '..')

const serviceRoots = [
  {
    label: 'lindong api',
    root: path.join(backendRoot, 'lindong-api'),
    requiredFiles: ['package.json', 'Dockerfile', 'miniprogram-container/server.js']
  },
  {
    label: 'console api',
    root: path.join(backendRoot, 'console-api-service'),
    requiredFiles: ['package.json', 'Dockerfile', 'console-api/server.js']
  }
]

const main = () => {
  let hasIssues = false

  serviceRoots.forEach(service => {
    if (!fs.existsSync(service.root)) {
      hasIssues = true
      console.error(`[services:check] missing service root: ${path.relative(backendRoot, service.root)}`)
      return
    }

    const missingFiles = service.requiredFiles.filter(relativePath => (
      !fs.existsSync(path.join(service.root, relativePath))
    ))

    if (missingFiles.length > 0) {
      hasIssues = true
      console.error(`[services:check] ${service.label} is incomplete`)
      missingFiles.forEach(relativePath => {
        console.error(`- missing ${path.join(path.relative(backendRoot, service.root), relativePath)}`)
      })
      return
    }

    console.log(`[services:check] ${service.label} ready: ${path.relative(backendRoot, service.root)}`)
  })

  if (hasIssues) {
    process.exit(1)
  }
}

main()
