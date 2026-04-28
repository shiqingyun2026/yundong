const assert = require('node:assert/strict')
const test = require('node:test')

const lindongHelpers = require('../lindong-api/repositories/_helpers')
const consoleHelpers = require('../console-api-service/repositories/_helpers')
const lindongDateTime = require('../lindong-api/shared/utils/dateTime')
const consoleDateTime = require('../console-api-service/shared/utils/dateTime')

test('repository date helpers write MySQL DATETIME in Shanghai time', () => {
  const instant = new Date('2026-04-26T09:00:00.000Z')

  assert.equal(lindongHelpers.toDbDateTime(instant), '2026-04-26 17:00:00')
  assert.equal(consoleHelpers.toDbDateTime(instant), '2026-04-26 17:00:00')
})

test('shared datetime helpers treat MySQL DATETIME strings as Shanghai local time', () => {
  const mysqlDateTime = '2026-04-28 10:00:00'

  assert.equal(lindongDateTime.parseShanghaiDate(mysqlDateTime)?.toISOString(), '2026-04-28T02:00:00.000Z')
  assert.equal(consoleDateTime.parseShanghaiDate(mysqlDateTime)?.toISOString(), '2026-04-28T02:00:00.000Z')
  assert.equal(lindongDateTime.formatShanghaiDateTime(mysqlDateTime), '2026-04-28 10:00:00')
  assert.equal(consoleDateTime.formatShanghaiDateTime(mysqlDateTime), '2026-04-28 10:00:00')
})
