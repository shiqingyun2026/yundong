const assert = require('node:assert/strict')
const test = require('node:test')

const { normalizePackageDetail, normalizePackageGroupDetail } = require('../utils/package')

test('normalizePackageDetail preserves textarea line breaks for rich-text rendering', () => {
  const detail = normalizePackageDetail({
    coach_intro: '第一行\n第二行',
    description: '课程介绍第一行\n课程介绍第二行'
  })

  assert.equal(detail.coachIntro, '第一行<br />第二行')
  assert.equal(detail.description, '课程介绍第一行<br />课程介绍第二行')
})

test('normalizePackageGroupDetail preserves line breaks and keeps image markup intact', () => {
  const groupDetail = normalizePackageGroupDetail({
    package: {
      coach_intro: '教练简介第一行\n<img src="https://example.com/coach.png">',
      description: '介绍第一行\n介绍第二行'
    }
  })

  assert.equal(
    groupDetail.packageInfo.coachIntro,
    '教练简介第一行<br /><img src="https://example.com/coach.png" style="display:block;box-sizing:border-box;max-width:100%;width:100%;height:auto;margin:0 auto;" />'
  )
  assert.equal(groupDetail.packageInfo.description, '介绍第一行<br />介绍第二行')
})
