const express = require('../../lib/mini-express')
const crypto = require('crypto')

const supabase = require('../../utils/supabase')
const { fail, ok } = require('./_helpers')

const router = express.Router()

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

router.post('/sign', async (req, res) => {
  const { filename, contentType, folder } = req.body || {}

  if (!filename || !contentType) {
    return fail(res, 5000, 'filename 和 contentType 不能为空')
  }

  try {
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

    return ok(res, {
      bucket: DEFAULT_BUCKET,
      path: objectPath,
      token: data && data.token ? data.token : '',
      signed_url: data && data.signedUrl ? data.signedUrl : '',
      upload_url: uploadUrl,
      public_url:
        publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl
          ? publicUrlResult.data.publicUrl
          : ''
    })
  } catch (error) {
    return fail(res, 5000, error.message || '生成上传签名失败', 500)
  }
})

module.exports = router
