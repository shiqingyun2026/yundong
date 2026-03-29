require('dotenv').config()

const express = require('../lib/mini-express')
const consoleApiRoutes = require('./routes')

const app = express()

app.use(express.cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-console-api'
  })
})

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-console-api',
    endpoints: {
      health: '/health',
      admin: '/api/admin/*'
    }
  })
})

app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})

app.use('/api/admin', consoleApiRoutes)

module.exports = app
