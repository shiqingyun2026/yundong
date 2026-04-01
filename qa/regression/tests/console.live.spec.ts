import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const username = process.env.CONSOLE_LIVE_USERNAME || 'admin'
const password = process.env.CONSOLE_LIVE_PASSWORD || 'admin123456'
const consoleApiBaseUrl = `http://127.0.0.1:${process.env.CONSOLE_API_PORT || '8100'}`
const seededPendingCourseId = '11111111-1111-1111-1111-111111111101'
const seededCourseTitle = '[测试] 深圳南山周末体适能·待上架'
const seededCourseCategory = '体适能'
const seededCourseCoachIntro = '用于验证待上架课程不出现在用户端列表。'
const seededRefundedOrderNo = 'LD202603260007'
const seededAccountUsername = 't1'
const seededSuperAdminUsername = 'admin'
const seededCourseKeyword = '南山'
const seededLogAction = 'admin_login'

const getAccountStatusConfig = (rowText: string) => {
  const isDisabled = rowText.includes('停用')
  return {
    initialValue: isDisabled ? 'disabled' : 'active',
    initialLabel: isDisabled ? '停用' : '启用',
    toggledValue: isDisabled ? 'active' : 'disabled',
    toggledLabel: isDisabled ? '启用' : '停用'
  } as const
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login')

  await page.getByLabel('用户名').fill(username)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '进入后台' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览' })).toBeVisible()
  await expect(page.getByText(`${username} / super_admin`)).toBeVisible()
}

async function bootstrapAdminSession(page: Page, request: APIRequestContext) {
  const response = await request.post(`${consoleApiBaseUrl}/api/admin/login`, {
    data: {
      username,
      password
    }
  })

  expect(response.ok()).toBeTruthy()
  const payload = (await response.json()) as {
    code: number
    message: string
    data: {
      token: string
      user: {
        id: string
        username: string
        role: 'super_admin' | 'admin'
      }
    }
  }

  expect(payload.code).toBe(0)

  await page.addInitScript(session => {
    window.localStorage.setItem('console_admin_token', session.token)
    window.localStorage.setItem('console_admin_user', JSON.stringify(session.user))
  }, payload.data)
}

async function openSeededAccountEditor(page: Page) {
  await page.goto('/accounts')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('按用户名搜索').fill(seededAccountUsername)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const accountRow = page.locator('tbody tr').first()
  await expect(accountRow).toContainText(seededAccountUsername)
  await accountRow.getByRole('button', { name: '编辑' }).click()
  await expect(page.getByRole('heading', { name: '编辑管理员' })).toBeVisible()
  return accountRow
}

test('console live smoke: login page can authenticate against standalone console-api and render dashboard', async ({
  page
}) => {
  await loginAsAdmin(page)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: '数据概括' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('当前拼团中的课程')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('接口未返回 JSON，请确认后端服务是否正常')).toHaveCount(0)
})

test('console live smoke: seeded course order and account data render through standalone console-api', async ({
  page
}) => {
  await loginAsAdmin(page)

  await page.goto('/courses')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText(seededCourseTitle)).toBeVisible({ timeout: 15000 })

  await page.goto('/orders')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  const refundedOrderRow = page.locator('tbody tr').filter({ hasText: seededRefundedOrderNo }).first()
  await expect(refundedOrderRow).toBeVisible({ timeout: 15000 })
  await refundedOrderRow.getByRole('button', { name: '详情' }).click()
  await expect(page.getByRole('heading', { name: '订单详情' })).toBeVisible()
  await expect(page.getByText(seededRefundedOrderNo)).toBeVisible()
  await expect(page.getByText('退款类型：系统自动退款')).toBeVisible()

  await page.goto('/accounts')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText(seededAccountUsername)).toBeVisible({ timeout: 15000 })
  await expect(
    page.locator('tbody tr').filter({ hasText: seededSuperAdminUsername }).getByRole('cell', { name: 'super_admin' })
  ).toBeVisible()
})

test('console live smoke: logs and list filters work against standalone console-api', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto('/logs')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('管理员用户名').fill(seededSuperAdminUsername)
  await page.getByLabel('动作').selectOption(seededLogAction)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').first()).toContainText('admin / super_admin')
  await expect(page.locator('tbody tr').first()).toContainText(seededLogAction)
  await expect(page.locator('tbody tr').first()).toContainText('username: admin')

  await page.goto('/accounts')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('按用户名搜索').fill(seededAccountUsername)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr').first()).toContainText(seededAccountUsername)

  await page.goto('/courses')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('按课程名称搜索').fill(seededCourseKeyword)
  await page.getByLabel('课程类别').selectOption(seededCourseCategory)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page).toHaveURL(/keyword=%E5%8D%97%E5%B1%B1/)
  await expect(page).toHaveURL(/category=%E4%BD%93%E9%80%82%E8%83%BD/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededCourseTitle }).first()).toBeVisible()
})

test('console live smoke: account status update can be written and rolled back through standalone console-api', async ({
  page
}) => {
  await loginAsAdmin(page)
  const accountEditor = page.locator('form').first()

  let accountRow = await openSeededAccountEditor(page)
  const initialRowText = (await accountRow.textContent()) || ''
  const statusConfig = getAccountStatusConfig(initialRowText)
  await expect(accountRow).toContainText(statusConfig.initialLabel)
  await accountEditor.getByLabel('状态').selectOption(statusConfig.toggledValue)
  await accountEditor.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  accountRow = page.locator('tbody tr').first()
  await expect(accountRow).toContainText(seededAccountUsername)
  await expect(accountRow).toContainText(statusConfig.toggledLabel)

  await page.goto('/logs')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('管理员用户名').fill(seededSuperAdminUsername)
  await page.getByLabel('动作').selectOption('account_update')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page).toHaveURL(/action=account_update/)
  await expect(
    page.locator('tbody tr').filter({ hasText: 'account_update' }).filter({ hasText: `status: ${statusConfig.toggledValue}` }).first()
  ).toBeVisible({ timeout: 15000 })

  accountRow = await openSeededAccountEditor(page)
  await expect(accountRow).toContainText(statusConfig.toggledLabel)
  await accountEditor.getByLabel('状态').selectOption(statusConfig.initialValue)
  await accountEditor.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  accountRow = page.locator('tbody tr').first()
  await expect(accountRow).toContainText(seededAccountUsername)
  await expect(accountRow).toContainText(statusConfig.initialLabel)

  await page.goto('/logs')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('管理员用户名').fill(seededSuperAdminUsername)
  await page.getByLabel('动作').selectOption('account_update')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page).toHaveURL(/action=account_update/)
  await expect(
    page.locator('tbody tr').filter({ hasText: 'account_update' }).filter({ hasText: `status: ${statusConfig.initialValue}` }).first()
  ).toBeVisible({ timeout: 15000 })
})

test('console live smoke: seeded pending course can be updated and rolled back through standalone console-api', async ({
  page,
  request
}) => {
  await bootstrapAdminSession(page, request)

  const updatedCoachIntro = `${seededCourseCoachIntro}（live smoke）`
  const courseForm = page.locator('form').first()

  await page.goto(`/courses/${seededPendingCourseId}/edit`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: '编辑课程' })).toBeVisible()
  await expect(courseForm.getByLabel(/课程名称/)).toHaveValue(seededCourseTitle)
  await expect(courseForm.getByLabel(/教练简介/)).toHaveValue(seededCourseCoachIntro)

  await courseForm.getByLabel(/教练简介/).fill(updatedCoachIntro)
  await expect(courseForm.getByLabel(/教练简介/)).toHaveValue(updatedCoachIntro)
  await courseForm.getByRole('button', { name: '保存课程' }).click()

  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededCourseTitle }).first()).toBeVisible({ timeout: 15000 })

  await page.goto('/logs')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('管理员用户名').fill(seededSuperAdminUsername)
  await page.getByLabel('动作').selectOption('course_update')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page).toHaveURL(/action=course_update/)
  await expect(
    page.locator('tbody tr').filter({ hasText: 'course_update' }).filter({ hasText: seededCourseTitle }).first()
  ).toBeVisible({ timeout: 15000 })

  await page.goto(`/courses/${seededPendingCourseId}/edit`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(courseForm.getByLabel(/教练简介/)).toHaveValue(updatedCoachIntro)
  await courseForm.getByLabel(/教练简介/).fill(seededCourseCoachIntro)
  await expect(courseForm.getByLabel(/教练简介/)).toHaveValue(seededCourseCoachIntro)
  await courseForm.getByRole('button', { name: '保存课程' }).click()

  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })

  await page.goto(`/courses/${seededPendingCourseId}/edit`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(courseForm.getByLabel(/教练简介/)).toHaveValue(seededCourseCoachIntro)
})
