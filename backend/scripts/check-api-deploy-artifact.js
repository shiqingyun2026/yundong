const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const {
  backendRoot,
  deployRoot,
  includedDirectories,
  includedFiles
} = require('./deployArtifactConfig')

const hashFile = filePath => {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

const listFilesRecursively = baseDir => {
  const collected = []

  const walk = currentDir => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = path.relative(baseDir, absolutePath)

      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }

      if (entry.isFile()) {
        collected.push(relativePath)
      }
    }
  }

  walk(baseDir)
  return collected
}

const buildExpectedFileList = () => {
  const files = [...includedFiles]

  for (const directory of includedDirectories) {
    const sourceDir = path.join(backendRoot, directory)

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Missing source directory: ${directory}`)
    }

    for (const relativeFile of listFilesRecursively(sourceDir)) {
      files.push(path.join(directory, relativeFile))
    }
  }

  return files.sort()
}

const main = () => {
  if (!fs.existsSync(deployRoot)) {
    console.error(`[deploy:check] Missing deploy artifact directory: ${deployRoot}`)
    process.exit(1)
  }

  const expectedFiles = buildExpectedFileList()
  const issues = []

  for (const relativePath of expectedFiles) {
    const sourcePath = path.join(backendRoot, relativePath)
    const targetPath = path.join(deployRoot, relativePath)

    if (!fs.existsSync(targetPath)) {
      issues.push(`missing: ${relativePath}`)
      continue
    }

    if (hashFile(sourcePath) !== hashFile(targetPath)) {
      issues.push(`changed: ${relativePath}`)
    }
  }

  const actualFiles = listFilesRecursively(deployRoot).sort()
  const expectedFileSet = new Set(expectedFiles)

  for (const relativePath of actualFiles) {
    if (!expectedFileSet.has(relativePath)) {
      issues.push(`extra: ${relativePath}`)
    }
  }

  if (issues.length) {
    console.error('[deploy:check] deploy-artifacts/lindong-api-deploy is out of sync with backend/')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('[deploy:check] deploy-artifacts/lindong-api-deploy is in sync')
}

main()
