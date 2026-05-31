const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..', 'console-api-service')

const mockModule = (relativePath, exports) => {
  const modulePath = require.resolve(path.join(backendRoot, relativePath))
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  }
}

const clearModules = relativePaths => {
  relativePaths.forEach(relativePath => {
    delete require.cache[require.resolve(path.join(backendRoot, relativePath))]
  })
}

const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII='

test('upload service uses cos provider for signed and proxy upload', async () => {
  const targets = [
    'console-api/services/uploadService.js',
    'console-api/services/storage/cosProvider.js',
    'console-api/services/_errors.js'
  ]
  clearModules(targets)

  process.env.STORAGE_PROVIDER = 'cos'
  process.env.COS_BUCKET = 'lindong-1250000000'
  process.env.COS_REGION = 'ap-guangzhou'
  process.env.COS_SECRET_ID = 'secret-id'
  process.env.COS_SECRET_KEY = 'secret-key'
  process.env.COS_PUBLIC_BASE_URL = 'https://cdn.example.com'
  process.env.COS_UPLOAD_EXPIRES_SECONDS = '600'

  const originalFetch = global.fetch
  const requests = []
  global.fetch = async (url, options = {}) => {
    requests.push({
      url,
      options
    })

    return {
      ok: true,
      status: 200,
      text: async () => ''
    }
  }

  try {
    const { createUploadSignature, uploadImageByProxy } = require(path.join(backendRoot, 'console-api/services/uploadService.js'))

    const signature = await createUploadSignature({
      filename: 'cover.png',
      contentType: 'image/png',
      folder: 'course-cover'
    })

    assert.equal(signature.bucket, 'lindong-1250000000')
    assert.match(signature.upload_url, /cos\.ap-guangzhou\.myqcloud\.com/)
    assert.equal(signature.headers['Content-Type'], 'image/png')
    assert.match(signature.public_url, /^https:\/\/cdn\.example\.com\//)
    assert.match(signature.headers.Authorization, /q-sign-algorithm=sha1/)

    const uploadedImage = await uploadImageByProxy({
      filename: 'cover.png',
      contentType: 'image/png',
      folder: 'course-cover',
      fileBase64: `data:image/png;base64,${validPngBase64}`
    })

    assert.equal(uploadedImage.provider, 'cos')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].options.method, 'PUT')
    assert.equal(requests[0].options.headers['Content-Type'], 'image/png')
    assert.match(requests[0].options.headers.Authorization, /q-sign-algorithm=sha1/)
    assert.match(uploadedImage.public_url, /^https:\/\/cdn\.example\.com\//)
  } finally {
    global.fetch = originalFetch
  }
})

test('upload service rejects non-image content types for signed upload', async () => {
  const targets = [
    'console-api/services/uploadService.js',
    'console-api/services/storage/cosProvider.js',
    'console-api/services/_errors.js'
  ]
  clearModules(targets)

  process.env.STORAGE_PROVIDER = 'cos'
  process.env.COS_BUCKET = 'lindong-1250000000'
  process.env.COS_REGION = 'ap-guangzhou'
  process.env.COS_SECRET_ID = 'secret-id'
  process.env.COS_SECRET_KEY = 'secret-key'
  process.env.COS_PUBLIC_BASE_URL = 'https://cdn.example.com'

  const { createUploadSignature } = require(path.join(backendRoot, 'console-api/services/uploadService.js'))

  await assert.rejects(
    () =>
      createUploadSignature({
        filename: 'notes.txt',
        contentType: 'text/plain',
        folder: 'course-cover'
      }),
    error => {
      assert.equal(error.responseCode, 5000)
      assert.equal(error.statusCode, 400)
      assert.equal(error.message, '仅支持上传图片文件')
      return true
    }
  )
})

test('upload service rejects mismatched file signatures', async () => {
  const targets = [
    'console-api/services/uploadService.js',
    'console-api/services/storage/cosProvider.js',
    'console-api/services/_errors.js'
  ]
  clearModules(targets)

  process.env.STORAGE_PROVIDER = 'cos'
  process.env.COS_BUCKET = 'lindong-1250000000'
  process.env.COS_REGION = 'ap-guangzhou'
  process.env.COS_SECRET_ID = 'secret-id'
  process.env.COS_SECRET_KEY = 'secret-key'
  process.env.COS_PUBLIC_BASE_URL = 'https://cdn.example.com'

  const { uploadImageByProxy } = require(path.join(backendRoot, 'console-api/services/uploadService.js'))

  await assert.rejects(
    () =>
      uploadImageByProxy({
        filename: 'cover.png',
        contentType: 'image/png',
        folder: 'course-cover',
        fileBase64: Buffer.from('not-a-real-png').toString('base64')
      }),
    error => {
      assert.equal(error.responseCode, 5000)
      assert.equal(error.statusCode, 400)
      assert.equal(error.message, '图片文件内容与声明格式不匹配')
      return true
    }
  )
})
