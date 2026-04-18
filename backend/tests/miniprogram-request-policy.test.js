const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const requestPolicy = require(path.join(__dirname, '../../miniprogram/utils/requestPolicy.js'))

test('container transport does not attach bearer token by default', () => {
  const headers = requestPolicy.buildRequestHeaders({
    header: {
      'X-Test': '1'
    },
    token: 'token-123',
    transport: 'container'
  })

  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
    'X-Test': '1'
  })
})

test('http transport attaches bearer token by default', () => {
  const headers = requestPolicy.buildRequestHeaders({
    token: 'token-123',
    transport: 'http'
  })

  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token-123'
  })
})

test('includeAuthorization=true forces bearer token on container transport', () => {
  const headers = requestPolicy.buildRequestHeaders({
    token: 'token-123',
    transport: 'container',
    includeAuthorization: true
  })

  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token-123'
  })
})

test('http fallback restores bearer token for local develop retries', () => {
  const requestHeader = requestPolicy.buildRequestHeaders({
    token: 'token-123',
    transport: 'container'
  })

  const fallbackHeaders = requestPolicy.buildHttpFallbackHeaders({
    requestHeader,
    token: 'token-123'
  })

  assert.deepEqual(fallbackHeaders, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer token-123'
  })
})

test('http fallback keeps bearer removed when includeAuthorization=false', () => {
  const requestHeader = requestPolicy.buildRequestHeaders({
    token: 'token-123',
    transport: 'container',
    includeAuthorization: false
  })

  const fallbackHeaders = requestPolicy.buildHttpFallbackHeaders({
    requestHeader,
    token: 'token-123',
    includeAuthorization: false
  })

  assert.deepEqual(fallbackHeaders, {
    'Content-Type': 'application/json'
  })
})
