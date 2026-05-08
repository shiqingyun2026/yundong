const test = require('node:test')
const assert = require('node:assert/strict')

const loadConsoleApp = () => {
  delete process.env.CONSOLE_ORIGIN
  delete process.env.APP_ORIGIN

  delete require.cache[require.resolve('../config/env')]
  delete require.cache[require.resolve('../lib/mini-express')]
  delete require.cache[require.resolve('../console-api/app')]

  return require('../console-api/app')
}

test('preflight does not inject app-level CORS headers', async () => {
  const app = loadConsoleApp()
  const response = await app.fetch(
    new Request('http://127.0.0.1/api/admin/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://tttiyubao-4g141829bdf6a28d-1304042243.tcloudbaseapp.com',
        'Access-Control-Request-Method': 'POST'
      }
    })
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
  assert.equal(response.headers.get('access-control-allow-credentials'), null)
})
