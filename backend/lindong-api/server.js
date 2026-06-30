require('dotenv').config()

const app = require('./app')
const { startLifecycleScheduler } = require('./utils/lifecycleScheduler')

const port = Number(process.env.PORT) || 8000

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`)
  startLifecycleScheduler()
})
