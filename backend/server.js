require('dotenv').config()

const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const coursesRoutes = require('./routes/courses')
const groupsRoutes = require('./routes/groups')
const ordersRoutes = require('./routes/orders')
const userRoutes = require('./routes/user')

const app = express()
const port = Number(process.env.PORT) || 8000

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
app.use('/api/user', userRoutes)

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`)
})
