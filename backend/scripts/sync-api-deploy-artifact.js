const fs = require('fs')
const path = require('path')

const {
  backendRoot,
  deployRoot,
  includedDirectories,
  includedFiles
} = require('./deployArtifactConfig')

const ensureDir = dirPath => {
  fs.mkdirSync(dirPath, { recursive: true })
}

const cleanDirectory = dirPath => {
  if (!fs.existsSync(dirPath)) {
    return
  }

  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true })
  }
}

const copyEntry = relativePath => {
  const sourcePath = path.join(backendRoot, relativePath)
  const targetPath = path.join(deployRoot, relativePath)

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source entry: ${relativePath}`)
  }

  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    force: true,
    preserveTimestamps: true
  })
}

const main = () => {
  ensureDir(deployRoot)
  cleanDirectory(deployRoot)

  for (const file of includedFiles) {
    copyEntry(file)
  }

  for (const directory of includedDirectories) {
    copyEntry(directory)
  }

  const relativeDeployRoot = path.relative(process.cwd(), deployRoot)
  console.log(`[deploy:sync] Updated ${relativeDeployRoot || deployRoot}`)
}

main()
