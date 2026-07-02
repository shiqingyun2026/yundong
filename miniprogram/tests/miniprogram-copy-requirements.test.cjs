const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const rootDir = path.resolve(__dirname, '..')
const checkedDirs = ['pages', 'components', 'utils']
const checkedExtensions = new Set(['.js', '.wxml'])

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return listFiles(fullPath)
    }
    return checkedExtensions.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

function readMiniprogramText() {
  return checkedDirs
    .flatMap(dir => listFiles(path.join(rootDir, dir)))
    .map(filePath => fs.readFileSync(filePath, 'utf8'))
    .join('\n')
}

test('miniprogram copy follows package wording requirements', () => {
  const source = readMiniprogramText()
  const overviewWxml = fs.readFileSync(
    path.join(rootDir, 'components/course-overview-sections/index.wxml'),
    'utf8'
  )
  const startWxml = fs.readFileSync(path.join(rootDir, 'pages/package/start/index.wxml'), 'utf8')
  const paymentWxml = fs.readFileSync(path.join(rootDir, 'pages/payment/confirm/index.wxml'), 'utf8')

  assert.doesNotMatch(overviewWxml, /适用年龄/)
  assert.doesNotMatch(source, /学生/)
  assert.doesNotMatch(source, /家长手机号/)
  assert.doesNotMatch(source, /请家长提前做好安排/)
  assert.doesNotMatch(source, /每次上课，至少要求一个家长全程在场/)

  assert.match(startWxml, /学员信息/)
  assert.match(startWxml, /学员昵称/)
  assert.match(startWxml, /联系手机号/)
  assert.match(paymentWxml, /学员昵称/)
  assert.match(paymentWxml, /联系手机号/)
  assert.match(source, /请提前做好安排/)
})
