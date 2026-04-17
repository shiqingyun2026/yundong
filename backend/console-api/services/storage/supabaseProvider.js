const { getSupabaseStorageConfig } = require('../../../config/storage')
const supabase = require('../../../utils/supabase')
const { createConsoleApiError } = require('../_errors')

const assertSupabaseStorageReady = () => {
  if (!supabase || !supabase.storage) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 500,
      message: 'Supabase Storage 未配置，无法上传文件'
    })
  }
}

const uploadObject = async ({ objectPath, contentType, buffer }) => {
  assertSupabaseStorageReady()
  const config = getSupabaseStorageConfig()

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(objectPath, buffer, {
      contentType,
      upsert: false
    })

  if (error) {
    throw error
  }

  const publicUrlResult = supabase.storage.from(config.bucket).getPublicUrl(objectPath)

  return {
    bucket: config.bucket,
    path: objectPath,
    public_url:
      publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl
        ? publicUrlResult.data.publicUrl
        : ''
  }
}

const createSignedUpload = async ({ objectPath }) => {
  assertSupabaseStorageReady()
  const config = getSupabaseStorageConfig()

  const { data, error } = await supabase.storage.from(config.bucket).createSignedUploadUrl(objectPath)

  if (error) {
    throw error
  }

  const publicUrlResult = supabase.storage.from(config.bucket).getPublicUrl(objectPath)
  const signedUploadPath = data && data.signedUrl ? data.signedUrl : ''
  const uploadUrl =
    signedUploadPath && signedUploadPath.startsWith('http')
      ? signedUploadPath
      : `${config.baseUrl}/storage/v1${signedUploadPath}`

  return {
    bucket: config.bucket,
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
  createSignedUpload,
  uploadObject
}
