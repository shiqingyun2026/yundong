require('dotenv').config()

const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const coursesRoutes = require('./routes/courses')
const groupsRoutes = require('./routes/groups')
const ordersRoutes = require('./routes/orders')
const paymentsRoutes = require('./routes/payments')
const userRoutes = require('./routes/user')
const adminRoutes = require('./routes/admin')
const internalRoutes = require('./routes/internal')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    ok: true
  })
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
