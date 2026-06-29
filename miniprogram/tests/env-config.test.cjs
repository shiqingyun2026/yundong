const assert = require('node:assert/strict')
const test = require('node:test')

const {
  resolveApiTransportByEnv,
  resolveBaseURLByEnv,
  resolveCloudContainerServiceNameByEnv
} = require('../config/env')

test('develop env points to local HTTP API for local mini program debugging', () => {
  assert.equal(resolveApiTransportByEnv('develop'), 'http')
  assert.equal(resolveBaseURLByEnv('develop'), 'http://127.0.0.1:8000')
})

test('miniprogram envs point to production cloud container service', () => {
  assert.equal(resolveCloudContainerServiceNameByEnv('develop'), 'lindong-api')
  assert.equal(resolveCloudContainerServiceNameByEnv('trial'), 'lindong-api')
  assert.equal(resolveCloudContainerServiceNameByEnv('release'), 'lindong-api')
})

test('trial and release envs keep using cloud container transport', () => {
  assert.equal(resolveApiTransportByEnv('trial'), 'container')
  assert.equal(resolveApiTransportByEnv('release'), 'container')
})
