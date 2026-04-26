const assert = require('node:assert/strict')
const test = require('node:test')

const lindongHelpers = require('../lindong-api/repositories/_helpers')
const consoleHelpers = require('../console-api-service/repositories/_helpers')

test('repository date helpers write MySQL DATETIME in Shanghai time', () => {
  const instant = new Date('2026-04-26T09:00:00.000Z')

  assert.equal(lindongHelpers.toDbDateTime(instant), '2026-04-26 17:00:00')
  assert.equal(consoleHelpers.toDbDateTime(instant), '2026-04-26 17:00:00')
})
