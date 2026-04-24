require('dotenv').config()

process.env.TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY = process.env.TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY || 'true'

const express = require('../lib/mini-express')

const authRoutes = require('../routes/auth')
const bannersRoutes = require('../routes/banners')
const coursesRoutes = require('../routes/courses')
const groupsRoutes = require('../routes/groups')
const internalRoutes = require('../routes/internal')
const ordersRoutes = require('../routes/orders')
const packageGroupsRoutes = require('../routes/package-groups')
const packageOrdersRoutes = require('../routes/package-orders')
const packagesRoutes = require('../routes/packages')
const paymentsRoutes = require('../routes/payments')
const userRoutes = require('../routes/user')

const app = express()

app.use(express.cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    ok: true
  })
})

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'lindong-miniprogram-container',
    endpoints: {
      health: '/health',
      miniProgram: '/api/*'
    }
  })
})

app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})

app.use('/api/auth', authRoutes)
app.use('/api/banners', bannersRoutes)
app.use('/api/courses', coursesRoutes)
app.use('/api/packages', packagesRoutes)
app.use('/api/groups', groupsRoutes)
app.use('/api/internal', internalRoutes)
app.use('/api/package-groups', packageGroupsRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/package-orders', packageOrdersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/user', userRoutes)

module.exports = app
