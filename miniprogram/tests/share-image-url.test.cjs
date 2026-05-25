const assert = require('node:assert/strict')
const test = require('node:test')

const { resolveShareImageUrl } = require('../utils/package')

test('resolveShareImageUrl applies center crop parameters for unsplash covers', () => {
  const result = resolveShareImageUrl('https://images.unsplash.com/photo-123?a=1')
  const url = new URL(result)

  assert.equal(url.searchParams.get('fit'), 'crop')
  assert.equal(url.searchParams.get('crop'), 'center')
  assert.equal(url.searchParams.get('w'), '760')
  assert.equal(url.searchParams.get('h'), '608')
})

test('resolveShareImageUrl applies centered fill processing for oss covers', () => {
  const result = resolveShareImageUrl('https://bucket.oss-cn-shanghai.aliyuncs.com/course-cover.png')
  const url = new URL(result)

  assert.equal(
    url.searchParams.get('x-oss-process'),
    'image/resize,m_fill,w_760,h_608/quality,q_90'
  )
})

test('resolveShareImageUrl applies center crop processing for signed cos covers', () => {
  const result = resolveShareImageUrl(
    'https://demo-1250000000.cos.ap-shanghai.myqcloud.com/course-cover/banner.png?q-sign-algorithm=sha1&q-ak=test&q-signature=abc'
  )

  assert.match(
    result,
    /&imageMogr2\/crop\/760x608\/gravity\/center\/quality\/90$/
  )
})

test('resolveShareImageUrl applies center crop processing for cos-backed custom cdn covers', () => {
  const result = resolveShareImageUrl('https://cdn.example.com/course-cover/2026-05/banner.png')

  assert.match(
    result,
    /\?imageMogr2\/crop\/760x608\/gravity\/center\/quality\/90$/
  )
})
