require('dotenv').config()

const express = require('./lib/mini-express')

const authRoutes = require('./routes/auth')
const coursesRoutes = require('./routes/courses')
const groupsRoutes = require('./routes/groups')
const ordersRoutes = require('./routes/orders')
const paymentsRoutes = require('./routes/payments')
const userRoutes = require('./routes/user')
const adminRoutes = require('./routes/admin')
const internalRoutes = require('./routes/internal')

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
    service: 'lindong-backend',
    endpoints: {
      health: '/health',
      miniProgram: '/api/*',
      admin: '/api/admin/*'
    }
  })
})

app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})

app.use('/api/auth', authRoutes)
app.use('/api/courses', coursesRoutes)
app.use('/api/groups', groupsRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/user', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/internal', internalRoutes)

module.exports = app
