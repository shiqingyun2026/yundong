const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

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

const hashFile = filePath => {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

module.exports = {
  cleanDirectory,
  ensureDir,
  hashFile,
  listFilesRecursively
}
