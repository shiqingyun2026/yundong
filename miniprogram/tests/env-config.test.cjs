const assert = require('node:assert/strict')
const test = require('node:test')

const { resolveCloudContainerServiceNameByEnv } = require('../config/env')

test('miniprogram envs point to production cloud container service', () => {
  assert.equal(resolveCloudContainerServiceNameByEnv('develop'), 'lindong-api')
  assert.equal(resolveCloudContainerServiceNameByEnv('trial'), 'lindong-api')
  assert.equal(resolveCloudContainerServiceNameByEnv('release'), 'lindong-api')
})
