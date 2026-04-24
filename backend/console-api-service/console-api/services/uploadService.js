const crypto = require('crypto')

const { getAdminUploadConfig, getStorageProviderName } = require('../../config/storage')
const { createConsoleApiError } = require('./_errors')
const supabaseProvider = require('./storage/supabaseProvider')
const cosProvider = require('./storage/cosProvider')

const normalizeFolder = value => {
  const allowed = ['course-cover', 'course-gallery', 'course-detail', 'coach-cert']
  return allowed.includes(value) ? value : 'course-cover'
}

const sanitizeFilename = filename => {
  const original = `${filename || ''}`.trim()
  if (!original) {
    return 'file.bin'
  }

  const cleaned = original.replace(/[^a-zA-Z0-9._-]/g, '-')
  return cleaned || 'file.bin'
}

const buildObjectPath = ({ filename, folder }) => {
  const safeFolder = normalizeFolder(folder)
  const safeFilename = sanitizeFilename(filename)
  return `${safeFolder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFilename}`
}

const getStorageProvider = () => {
  const providerName = getStorageProviderName()

  if (providerName === 'supabase') {
    return supabaseProvider
  }

  if (providerName === 'cos') {
    return cosProvider
  }

  throw createConsoleApiError({
    responseCode: 5000,
    statusCode: 500,
    message: `暂不支持的存储 provider: ${providerName}`
  })
}

const decodeBase64File = base64Data => {
  const normalized = `${base64Data || ''}`.trim()
  if (!normalized) {
    return Buffer.alloc(0)
  }

  const payload = normalized.includes(',') ? normalized.split(',').pop() : normalized
  return Buffer.from(payload || '', 'base64')
}

const isPng = buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
const isJpeg = buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
const isGif = buffer =>
  buffer.length >= 6 &&
  (buffer.subarray(0, 6).equals(Buffer.from('GIF87a')) || buffer.subarray(0, 6).equals(Buffer.from('GIF89a')))
const isWebp = buffer =>
  buffer.length >= 12 &&
  buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
  buffer.subarray(8, 12).equals(Buffer.from('WEBP'))

const assertImageSignatureMatchesContentType = ({ buffer, contentType }) => {
  const normalizedType = `${contentType || ''}`.toLowerCase()

  const matched =
    (normalizedType === 'image/png' && isPng(buffer)) ||
    ((normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') && isJpeg(buffer)) ||
    (normalizedType === 'image/gif' && isGif(buffer)) ||
    (normalizedType === 'image/webp' && isWebp(buffer))

  if (!matched) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: '图片文件内容与声明格式不匹配'
    })
  }
}

const createUploadSignature = async ({ filename, contentType, folder }) => {
  if (!filename || !contentType) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: 'filename 和 contentType 不能为空'
    })
  }

  if (!contentType.startsWith('image/')) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: '仅支持上传图片文件'
    })
  }

  const objectPath = buildObjectPath({
    filename,
    folder
  })

  return getStorageProvider().createSignedUpload({
    objectPath,
    contentType
  })
}

const uploadImageByProxy = async ({ filename, contentType, folder, fileBase64 }) => {
  if (!filename || !contentType || !fileBase64) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: 'filename、contentType 和 fileBase64 不能为空'
    })
  }

  if (!contentType.startsWith('image/')) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: '仅支持上传图片文件'
    })
  }

  const buffer = decodeBase64File(fileBase64)
  if (!buffer.length) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: '上传文件内容不能为空'
    })
  }

  const { maxUploadBytes } = getAdminUploadConfig()
  if (buffer.length > maxUploadBytes) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 413,
      message: `图片不能超过 ${Math.round(maxUploadBytes / 1024 / 1024)}MB`
    })
  }

  assertImageSignatureMatchesContentType({
    buffer,
    contentType
  })

  const objectPath = buildObjectPath({
    filename,
    folder
  })

  const result = await getStorageProvider().uploadObject({
    objectPath,
    contentType,
    buffer
  })

  return {
    ...result,
    provider: getStorageProviderName(),
    size: buffer.length
  }
}

module.exports = {
  createUploadSignature,
  uploadImageByProxy
}
