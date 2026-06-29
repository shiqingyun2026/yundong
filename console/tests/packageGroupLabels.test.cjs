const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '../src/lib/packageGroupLabels.ts')
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

const { formatGroupConfigLabel, formatGroupConfigLabels } = moduleShim.exports

test('formats flexible package group labels with min and target counts', () => {
  assert.equal(formatGroupConfigLabel({ min_success_count: 1, target_count: 1, price_fen: 110000 }), '1对1私教')
  assert.equal(formatGroupConfigLabel({ min_success_count: 3, target_count: 4, price_fen: 42500 }), '3～4人团')
  assert.equal(formatGroupConfigLabel({ min_success_count: 5, target_count: 6, price_fen: 36000 }), '5～6人团')
})

test('formats package group config labels before falling back to supported people', () => {
  assert.equal(
    formatGroupConfigLabels({
      groupPriceConfig: [
        { min_success_count: 1, target_count: 1, price_fen: 110000 },
        { min_success_count: 2, target_count: 2, price_fen: 66000 },
        { min_success_count: 3, target_count: 4, price_fen: 42500 },
        { min_success_count: 5, target_count: 6, price_fen: 36000 }
      ],
      supportedPeople: [1, 2, 4, 6]
    }),
    '1对1私教 / 2人团 / 3～4人团 / 5～6人团'
  )
})
