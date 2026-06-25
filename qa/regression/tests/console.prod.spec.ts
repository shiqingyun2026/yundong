import { expect, test, type Page } from '@playwright/test'

const username = process.env.CONSOLE_PROD_USERNAME
const password = process.env.CONSOLE_PROD_PASSWORD
const seededPackageKeyword = process.env.CONSOLE_PROD_PACKAGE_KEYWORD || '课包'
const consoleProdBaseUrl = process.env.CONSOLE_PROD_BASE_URL || 'https://lindong-console.pages.dev'

test.beforeEach(() => {
  test.skip(!username || !password, 'Set CONSOLE_PROD_USERNAME and CONSOLE_PROD_PASSWORD before running console prod smoke.')
})

function getProdUrl(pathname = '') {
  return new URL(pathname, consoleProdBaseUrl.endsWith('/') ? consoleProdBaseUrl : `${consoleProdBaseUrl}/`).toString()
}

async function openProdPage(page: Page, pathname = '') {
  await page.goto(getProdUrl(pathname))

  const accessConfirmButton = page.getByRole('button', { name: /确定访问/ })
  if (await accessConfirmButton.isVisible().catch(() => false)) {
    await expect(accessConfirmButton).toBeEnabled({ timeout: 5000 })
    await accessConfirmButton.click()
  }
}

async function loginAsAdmin(page: Page) {
  await openProdPage(page)

  await expect(page.getByLabel('用户名')).toBeVisible()
  await expect(page.getByLabel('密码')).toBeVisible()
  await page.getByLabel('用户名').fill(username || '')
  await page.getByLabel('密码').fill(password || '')
  await page.getByRole('button', { name: '进入后台' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览' })).toBeVisible()
}

async function openConsoleSection(page: Page, linkName: string) {
  await page.getByRole('link', { name: linkName, exact: true }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
}

test('console prod smoke: login and package dashboard render successfully', async ({ page }) => {
  await loginAsAdmin(page)

  await expect(page.getByText('课包经营数据')).toBeVisible()
  await expect(page.getByRole('heading', { name: '异常提醒' })).toBeVisible()
  await expect(page.getByRole('link', { name: '课包管理', exact: true })).toBeVisible()
})

test('console prod smoke: package list renders package columns and status filter', async ({ page }) => {
  await loginAsAdmin(page)

  await openConsoleSection(page, '课包管理')
  await expect(page.getByRole('columnheader', { name: '课包名称' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '支持人数' })).toBeVisible()
  await expect(page.getByLabel('课包状态')).toBeVisible()

  await page.getByPlaceholder('按课包编号或名称搜索').fill(seededPackageKeyword)
  await page.getByLabel('课包状态').selectOption('active')
  await page.getByRole('button', { name: '查询' }).click()

  await expect(page).toHaveURL(/keyword=/)
  await expect(page).toHaveURL(/status=active/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

test('console prod smoke: package detail renders package field set', async ({ page }) => {
  await loginAsAdmin(page)

  await openConsoleSection(page, '课包管理')

  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await firstRow.getByRole('link', { name: '查看', exact: true }).click()

  await expect(page.getByRole('heading', { name: '课包详情' })).toBeVisible()
  await expect(page.getByLabel(/课包名称/)).toBeVisible()
  await expect(page.getByLabel(/团型人数/)).toBeVisible()
  await expect(page.getByRole('heading', { name: '教练简介' })).toBeVisible()
})

test('console prod smoke: package groups orders and logs pages are reachable after login', async ({ page }) => {
  await loginAsAdmin(page)

  await openConsoleSection(page, '课包拼团')
  await expect(page.getByRole('columnheader', { name: '拼团编号' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible()

  await openConsoleSection(page, '课包订单')
  await expect(page.getByRole('heading', { name: '订单详情' })).toBeVisible()

  await openConsoleSection(page, '操作日志')
  await expect(page.getByRole('columnheader', { name: '管理员' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
})
