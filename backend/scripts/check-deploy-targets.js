const fs = require('fs')
const path = require('path')

const {
  hashFile,
  listFilesRecursively
} = require('./sharedDeployTargetUtils')
const {
  backendRoot,
  deployTargets
} = require('./deployTargetConfig')

const buildExpectedFileList = target => {
  const files = [...target.includedFiles]
  const excludedFiles = new Set(target.excludedFiles || [])
  const renameFiles = target.renameFiles || {}

  for (const directory of target.includedDirectories) {
    const sourceDir = path.join(backendRoot, directory)

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Missing source directory: ${directory}`)
    }

    for (const relativeFile of listFilesRecursively(sourceDir)) {
      const relativePath = path.join(directory, relativeFile)
      if (!excludedFiles.has(relativePath)) {
        files.push(relativePath)
      }
    }
  }

  return files
    .filter(relativePath => !excludedFiles.has(relativePath))
    .map(relativePath => renameFiles[relativePath] || relativePath)
    .sort()
}

const checkTarget = target => {
  if (!fs.existsSync(target.targetRoot)) {
    return [`missing target root: ${target.label}`]
  }

  const expectedFiles = buildExpectedFileList(target)
  const expectedFileSet = new Set(expectedFiles)
  const issues = []

  for (const relativePath of expectedFiles) {
    const sourceRelativePath = Object.entries(target.renameFiles || {}).find(([, value]) => value === relativePath)?.[0] || relativePath
    const sourcePath = path.join(backendRoot, sourceRelativePath)
    const targetPath = path.join(target.targetRoot, relativePath)

    if (!fs.existsSync(targetPath)) {
      issues.push(`missing: ${relativePath}`)
      continue
    }

    if (hashFile(sourcePath) !== hashFile(targetPath)) {
      issues.push(`changed: ${relativePath}`)
    }
  }

  for (const relativePath of listFilesRecursively(target.targetRoot).sort()) {
    if (!expectedFileSet.has(relativePath)) {
      issues.push(`extra: ${relativePath}`)
    }
  }

  return issues
}

const main = () => {
  let hasIssues = false

  Object.values(deployTargets).forEach(target => {
    const issues = checkTarget(target)

    if (issues.length) {
      hasIssues = true
      console.error(`[deploy:check] ${target.label} is out of sync with backend/`)
      issues.forEach(issue => console.error(`- ${issue}`))
      return
    }

    console.log(`[deploy:check] ${target.label} is in sync`)
  })

  if (hasIssues) {
    process.exit(1)
  }
}

main()
