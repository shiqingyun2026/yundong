const { requireMySqlEnv } = require('./env')

let mysqlModule = null
let pool = null

const loadMySqlModule = () => {
  if (mysqlModule) {
    return mysqlModule
  }

  try {
    mysqlModule = require('mysql2/promise')
    return mysqlModule
  } catch (error) {
    const dependencyError = new Error('mysql2 is required before using backend/config/db.js')
    dependencyError.code = 'MYSQL2_MISSING'
    dependencyError.cause = error
    throw dependencyError
  }
}

const createPool = () => {
  const mysql = loadMySqlModule()
  const config = requireMySqlEnv()

  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    waitForConnections: true,
    namedPlaceholders: true,
    timezone: 'Z'
  })
}

const getPool = () => {
  if (!pool) {
    pool = createPool()
  }

  return pool
}

const resolveExecutor = executor => executor || getPool()

const query = async (sql, params = [], executor = null) => {
  const [rows] = await resolveExecutor(executor).query(sql, params)
  return rows
}

const execute = async (sql, params = [], executor = null) => {
  const [result] = await resolveExecutor(executor).execute(sql, params)
  return result
}

const withTransaction = async run => {
  const connection = await getPool().getConnection()

  try {
    await connection.beginTransaction()

    const transaction = {
      connection,
      query: (sql, params = []) => query(sql, params, connection),
      execute: (sql, params = []) => execute(sql, params, connection)
    }

    const result = await run(transaction)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

const closePool = async () => {
  if (!pool) {
    return
  }

  const currentPool = pool
  pool = null
  await currentPool.end()
}

module.exports = {
  closePool,
  createPool,
  execute,
  getPool,
  query,
  withTransaction
}
