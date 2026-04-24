const fs = require('fs')
const path = require('path')

const {
  cleanDirectory,
  ensureDir
} = require('./sharedDeployTargetUtils')
const {
  backendRoot,
  deployTargets
} = require('./deployTargetConfig')

const copyEntry = (targetRoot, relativePath) => {
  const sourcePath = path.join(backendRoot, relativePath)
  const destinationPath = path.join(targetRoot, relativePath)

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source entry: ${relativePath}`)
  }

  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    preserveTimestamps: true
  })
}

const syncTarget = target => {
  ensureDir(target.targetRoot)
  cleanDirectory(target.targetRoot)
  const excludedFiles = new Set(target.excludedFiles || [])
  const renameFiles = target.renameFiles || {}

  for (const file of target.includedFiles) {
    if (excludedFiles.has(file)) {
      continue
    }
    copyEntry(target.targetRoot, file)

    const renamedPath = renameFiles[file]
    if (renamedPath) {
      fs.renameSync(
        path.join(target.targetRoot, file),
        path.join(target.targetRoot, renamedPath)
      )
    }
  }

  for (const directory of target.includedDirectories) {
    copyEntry(target.targetRoot, directory)
  }

  excludedFiles.forEach(relativePath => {
    fs.rmSync(path.join(target.targetRoot, relativePath), { recursive: true, force: true })
  })

  const relativeTargetRoot = path.relative(process.cwd(), target.targetRoot)
  console.log(`[deploy:sync] Updated ${relativeTargetRoot || target.targetRoot}`)
}

const main = () => {
  Object.values(deployTargets).forEach(syncTarget)
}

main()
