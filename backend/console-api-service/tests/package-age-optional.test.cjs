const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..', '..')
const servicePath = path.join(root, 'backend/console-api-service/console-api/services/packageAdminService.js')
const formPath = path.join(root, 'console/src/pages/PackageFormPage.tsx')

test('package admin service does not require age range', () => {
  const source = fs.readFileSync(servicePath, 'utf8')
  const requiredFieldsBlock = source.match(/const requiredFields = \[[\s\S]*?\n  \]/)

  assert.ok(requiredFieldsBlock, 'required fields block should exist')
  assert.doesNotMatch(requiredFieldsBlock[0], /age_range/)
  assert.doesNotMatch(requiredFieldsBlock[0], /适用年龄不能为空/)
  assert.match(source, /assign\('age_range', 'age_range', normalizeText\)/)
})

test('package form does not mark age range as required or block submit when empty', () => {
  const source = fs.readFileSync(formPath, 'utf8')
  const ageLabelBlock = source.match(/<span>适用年龄[\s\S]*?<\/span>/)

  assert.ok(ageLabelBlock, 'age range label should exist')
  assert.doesNotMatch(ageLabelBlock[0], /RequiredMark/)
  assert.doesNotMatch(source, /请填写适用年龄/)
  assert.doesNotMatch(source, /!form\.age_range\.trim\(\)/)
  assert.match(source, /age_range: form\.age_range\.trim\(\)/)
})
