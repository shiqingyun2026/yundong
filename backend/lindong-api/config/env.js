require('dotenv').config()

const pickFirst = (...values) => {
  for (const value of values) {
    const normalized = `${value || ''}`.trim()
    if (normalized) {
      return normalized
    }
  }

  return ''
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(`${value || ''}`.trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBool = (value, fallback = false) => {
  const normalized = `${value || ''}`.trim().toLowerCase()

  if (!normalized) {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

const getOptionalEnv = key => `${process.env[key] || ''}`.trim()

const getRequiredEnv = key => {
  const value = getOptionalEnv(key)

  if (!value) {
    throw new Error(`${key} is required`)
  }

  return value
}

const env = {
  nodeEnv: pickFirst(process.env.NODE_ENV, 'development'),
  port: toInt(process.env.PORT, 8000),
  jwtSecret: getOptionalEnv('JWT_SECRET'),
  appOrigin: getOptionalEnv('APP_ORIGIN'),
  consoleOrigin: getOptionalEnv('CONSOLE_ORIGIN'),
  useMySqlRepositories: toBool(process.env.USE_MYSQL_REPOSITORIES),
  paymentProviderMode: pickFirst(process.env.PAYMENT_PROVIDER_MODE, 'mock').toLowerCase(),
  internalPaymentSecret: getOptionalEnv('INTERNAL_PAYMENT_SECRET'),
  trustCloudBaseMiniProgramIdentity: toBool(process.env.TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY),
  enableMiniProgramIdentityLogs: toBool(process.env.ENABLE_MINIPROGRAM_IDENTITY_LOGS),
  mysql: {
    host: pickFirst(process.env.MYSQL_HOST, process.env.DB_HOST),
    port: toInt(pickFirst(process.env.MYSQL_PORT, process.env.DB_PORT), 3306),
    user: pickFirst(process.env.MYSQL_USER, process.env.DB_USER),
    password: pickFirst(process.env.MYSQL_PASSWORD, process.env.DB_PASSWORD),
    database: pickFirst(process.env.MYSQL_DATABASE, process.env.DB_DATABASE),
    connectionLimit: toInt(process.env.MYSQL_CONNECTION_LIMIT, 10)
  },
  storage: {
    provider: pickFirst(process.env.STORAGE_PROVIDER, 'cos').toLowerCase(),
    supabaseBucket: pickFirst(process.env.SUPABASE_STORAGE_BUCKET, 'course-images'),
    bucket: pickFirst(process.env.COS_BUCKET, process.env.CLOUDBASE_STORAGE_BUCKET),
    region: pickFirst(process.env.COS_REGION, process.env.CLOUDBASE_STORAGE_REGION),
    publicBaseUrl: getOptionalEnv('COS_PUBLIC_BASE_URL'),
    uploadExpiresSeconds: toInt(process.env.COS_UPLOAD_EXPIRES_SECONDS, 900),
    maxUploadBytes: toInt(process.env.ADMIN_UPLOAD_MAX_BYTES, 5 * 1024 * 1024)
  }
}

const isProductionLike = () => ['production', 'staging'].includes(env.nodeEnv)

const requireMySqlEnv = () => {
  const requiredKeys = ['host', 'user', 'database']

  for (const key of requiredKeys) {
    if (!env.mysql[key]) {
      throw new Error(`mysql config "${key}" is required`)
    }
  }

  return env.mysql
}

module.exports = {
  env,
  getOptionalEnv,
  getRequiredEnv,
  isProductionLike,
  pickFirst,
  requireMySqlEnv,
  toBool,
  toInt
}
