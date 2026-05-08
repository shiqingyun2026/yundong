const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '../src/lib/routerBase.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText

const moduleExports = {}
const moduleShim = { exports: moduleExports }
new Function('exports', 'module', compiled)(moduleExports, moduleShim)

const { resolveRouterBasename } = moduleShim.exports

test('normalizes vite asset base for React Router basename', () => {
  assert.equal(resolveRouterBasename('/console/'), '/console')
  assert.equal(resolveRouterBasename('/console'), '/console')
  assert.equal(resolveRouterBasename('console/'), '/console')
})

test('keeps root deployment basename unset', () => {
  assert.equal(resolveRouterBasename('/'), undefined)
  assert.equal(resolveRouterBasename(''), undefined)
  assert.equal(resolveRouterBasename(undefined), undefined)
})
