const assert = require('node:assert/strict')
const test = require('node:test')

const {
  resolveApiTransportByEnv,
  resolveBaseURLByEnv,
  resolveCloudContainerServiceNameByEnv
} = require('../config/env')

test('develop env points to test cloud container for WeChat devtools debugging', () => {
  assert.equal(resolveApiTransportByEnv('develop'), 'container')
  assert.equal(resolveBaseURLByEnv('develop'), '')
  assert.equal(resolveCloudContainerServiceNameByEnv('develop'), 'lindong-api-test')
})

test('develop and trial envs point to test cloud container service', () => {
  assert.equal(resolveCloudContainerServiceNameByEnv('develop'), 'lindong-api-test')
  assert.equal(resolveCloudContainerServiceNameByEnv('trial'), 'lindong-api-test')
  assert.equal(resolveCloudContainerServiceNameByEnv('release'), 'lindong-api')
})

test('all miniprogram envs keep using cloud container transport', () => {
  assert.equal(resolveApiTransportByEnv('develop'), 'container')
  assert.equal(resolveApiTransportByEnv('trial'), 'container')
  assert.equal(resolveApiTransportByEnv('release'), 'container')
})
