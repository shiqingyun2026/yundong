const test = require('node:test')
const assert = require('node:assert/strict')

const { createPageHarness, createWxMock, loadPageDefinition } = require('./helpers.cjs')

const packageUtils = require('../../../../miniprogram/utils/package')

test('miniprogram my group list page: tab switch reloads matching status and resets paging', async () => {
  const originalFetchUserPackageGroupList = packageUtils.fetchUserPackageGroupList
  const { wx } = createWxMock()
  global.wx = wx

  const requestedStatuses = []
  packageUtils.fetchUserPackageGroupList = async ({ status, page }) => {
    requestedStatuses.push({ status, page })
    return {
      list: status === 'success' ? [{ packageGroupId: 'success-1', packageName: '已成团课包' }] : [{ packageGroupId: 'active-1', packageName: '进行中课包' }],
      hasMore: false
    }
  }

  const page = createPageHarness(loadPageDefinition('pages/my/group-buy-list/index.js'))
  await page.onLoad()
  await page.handleTabTap({
    currentTarget: {
      dataset: {
        key: 'success'
      }
    }
  })

  assert.deepEqual(requestedStatuses, [
    { status: 'all', page: 1 },
    { status: 'success', page: 1 }
  ])
  assert.equal(page.data.activeTab, 'success')
  assert.equal(page.data.groupList[0].packageGroupId, 'success-1')

  packageUtils.fetchUserPackageGroupList = originalFetchUserPackageGroupList
})

test('miniprogram my group list page: reach bottom appends next page when hasMore is true', async () => {
  const originalFetchUserPackageGroupList = packageUtils.fetchUserPackageGroupList
  const { wx } = createWxMock()
  global.wx = wx

  packageUtils.fetchUserPackageGroupList = async ({ page }) => ({
    list: [{ packageGroupId: `group-${page}` }],
    hasMore: page < 2
  })

  const page = createPageHarness(loadPageDefinition('pages/my/group-buy-list/index.js'))
  await page.onLoad()
  await page.onReachBottom()

  assert.deepEqual(
    page.data.groupList.map(item => item.packageGroupId),
    ['group-1', 'group-2']
  )
  assert.equal(page.data.page, 2)
  assert.equal(page.data.hasMore, false)

  packageUtils.fetchUserPackageGroupList = originalFetchUserPackageGroupList
})
