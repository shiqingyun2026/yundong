const { pickFirst, toInt } = require('./env')

const getStorageProviderName = () => pickFirst(process.env.STORAGE_PROVIDER, 'cos').toLowerCase()

const getSupabaseStorageConfig = () => ({
  provider: 'supabase',
  bucket: pickFirst(process.env.SUPABASE_STORAGE_BUCKET, 'course-images'),
  baseUrl: `${process.env.SUPABASE_URL || ''}`.trim()
})

const getCosStorageConfig = () => ({
  provider: 'cos',
  bucket: pickFirst(process.env.COS_BUCKET, process.env.CLOUDBASE_STORAGE_BUCKET),
  region: pickFirst(process.env.COS_REGION, process.env.CLOUDBASE_STORAGE_REGION),
  secretId: `${process.env.COS_SECRET_ID || ''}`.trim(),
  secretKey: `${process.env.COS_SECRET_KEY || ''}`.trim(),
  publicBaseUrl: `${process.env.COS_PUBLIC_BASE_URL || ''}`.trim(),
  expiresSeconds: Math.max(1, toInt(process.env.COS_UPLOAD_EXPIRES_SECONDS, 900))
})

const getStorageConfig = () => {
  if (getStorageProviderName() === 'cos') {
    return getCosStorageConfig()
  }

  return getSupabaseStorageConfig()
}

const getAdminUploadConfig = () => ({
  maxUploadBytes: Math.max(1, toInt(process.env.ADMIN_UPLOAD_MAX_BYTES, 5 * 1024 * 1024))
})

module.exports = {
  getAdminUploadConfig,
  getCosStorageConfig,
  getStorageConfig,
  getStorageProviderName,
  getSupabaseStorageConfig
}
