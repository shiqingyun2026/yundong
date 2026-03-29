const crypto = require('crypto')

const { createConsoleApiError } = require('./_errors')
const supabase = require('../../utils/supabase')

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'course-images'
const SUPABASE_URL = process.env.SUPABASE_URL || ''

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

const createUploadSignature = async ({ filename, contentType, folder }) => {
  if (!filename || !contentType) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 400,
      message: 'filename 和 contentType 不能为空'
    })
  }

  const safeFolder = normalizeFolder(folder)
  const safeFilename = sanitizeFilename(filename)
  const objectPath = `${safeFolder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFilename}`

  const { data, error } = await supabase.storage.from(DEFAULT_BUCKET).createSignedUploadUrl(objectPath)

  if (error) {
    throw error
  }

  const publicUrlResult = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath)
  const signedUploadPath = data && data.signedUrl ? data.signedUrl : ''
  const uploadUrl =
    signedUploadPath && signedUploadPath.startsWith('http')
      ? signedUploadPath
      : `${SUPABASE_URL}/storage/v1${signedUploadPath}`

  return {
    bucket: DEFAULT_BUCKET,
    path: objectPath,
    token: data && data.token ? data.token : '',
    signed_url: data && data.signedUrl ? data.signedUrl : '',
    upload_url: uploadUrl,
    public_url:
      publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl
        ? publicUrlResult.data.publicUrl
        : ''
  }
}

module.exports = {
  createUploadSignature
}
