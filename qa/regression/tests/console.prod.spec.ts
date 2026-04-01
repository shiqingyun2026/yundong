import { expect, test, type Page } from '@playwright/test'

const username = process.env.CONSOLE_PROD_USERNAME
const password = process.env.CONSOLE_PROD_PASSWORD
const seededCourseKeyword = process.env.CONSOLE_PROD_COURSE_KEYWORD || '南山'
const seededCourseCategory = process.env.CONSOLE_PROD_COURSE_CATEGORY || '体适能'

test.beforeEach(() => {
  test.skip(!username || !password, 'Set CONSOLE_PROD_USERNAME and CONSOLE_PROD_PASSWORD before running console prod smoke.')
})

async function loginAsAdmin(page: Page) {
  await page.goto('/login')

  await expect(page.getByLabel('用户名')).toBeVisible()
  await expect(page.getByLabel('密码')).toBeVisible()
  await page.getByLabel('用户名').fill(username || '')
  await page.getByLabel('密码').fill(password || '')
  await page.getByRole('button', { name: '进入后台' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览' })).toBeVisible()
}

test('console prod smoke: login and dashboard render successfully', async ({ page }) => {
  await loginAsAdmin(page)

  await expect(page.getByText('数据概括')).toBeVisible()
  await expect(page.getByText('异常提示')).toBeVisible()
})

test('console prod smoke: course list renders category column and category filter', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto('/courses')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByRole('columnheader', { name: '课程类别' })).toBeVisible()
  await expect(page.getByLabel('课程类别')).toBeVisible()

  await page.getByPlaceholder('按课程名称搜索').fill(seededCourseKeyword)
  await page.getByLabel('课程类别').selectOption(seededCourseCategory)
  await page.getByRole('button', { name: '查询' }).click()

  await expect(page).toHaveURL(/keyword=/)
  await expect(page).toHaveURL(/category=/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.locator('tbody tr td').nth(1)).not.toHaveText('-')
})

test('console prod smoke: course detail renders category field', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto('/courses')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })

  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  await firstRow.getByRole('link', { name: '查看' }).click()

  await expect(page.getByRole('heading', { name: '课程详情' })).toBeVisible()
  await expect(page.getByLabel('课程类别')).toBeVisible()
  await expect(page.getByLabel('课程类别')).not.toHaveValue('')
})

test('console prod smoke: orders and logs pages are reachable after login', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto('/orders')
  await expect(page.getByRole('heading', { name: '订单详情' })).toBeVisible()

  await page.goto('/logs')
  await expect(page.getByRole('columnheader', { name: '管理员' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
})
