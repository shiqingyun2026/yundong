require('dotenv').config()

const app = require('./app')

const port = Number(process.env.PORT) || 8000

app.listen(port, () => {
  console.log(`MiniProgram container server listening on port ${port}`)
})
