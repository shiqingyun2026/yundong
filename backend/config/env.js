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
  useMySqlRepositories: pickFirst(process.env.USE_MYSQL_REPOSITORIES, 'false').toLowerCase() === 'true',
  mysql: {
    host: pickFirst(process.env.MYSQL_HOST, process.env.DB_HOST),
    port: toInt(pickFirst(process.env.MYSQL_PORT, process.env.DB_PORT), 3306),
    user: pickFirst(process.env.MYSQL_USER, process.env.DB_USER),
    password: pickFirst(process.env.MYSQL_PASSWORD, process.env.DB_PASSWORD),
    database: pickFirst(process.env.MYSQL_DATABASE, process.env.DB_DATABASE),
    connectionLimit: toInt(process.env.MYSQL_CONNECTION_LIMIT, 10)
  },
  storage: {
    bucket: pickFirst(process.env.COS_BUCKET, process.env.CLOUDBASE_STORAGE_BUCKET),
    region: pickFirst(process.env.COS_REGION, process.env.CLOUDBASE_STORAGE_REGION)
  }
}

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
  pickFirst,
  requireMySqlEnv,
  toInt
}
