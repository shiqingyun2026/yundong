import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const username = process.env.CONSOLE_LIVE_USERNAME || 'admin'
const password = process.env.CONSOLE_LIVE_PASSWORD || 'admin123456'
const consoleApiBaseUrl = `http://127.0.0.1:${process.env.CONSOLE_API_PORT || '8100'}`

const seededPackageId = 'package_seed_active_002'
const seededPackageName = '[课包回归] 进行中少儿体适能 5 次课'
const seededPackageKeyword = '进行中少儿体适能'
const seededSuccessPackageId = 'package_seed_success_003'
const seededSuccessPackageName = '[课包回归] 已成团平衡训练 5 次课'
const seededFailedPackageId = 'package_seed_failed_004'
const seededFailedPackageOrderNo = 'LDPKG20260419007'
const seededPackageOrderNo = 'LDPKG20260419001'
const seededPackageGroupId = 'pkg_group_seed_001'
const seededAccountUsername = 'admin'
const seededSuperAdminUsername = 'admin'
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

test('console live smoke: login page can authenticate against standalone console-api and render package dashboard', async ({
  page
}) => {
  await loginAsAdmin(page)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: '课包拼团概览' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('课包经营数据')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('当前上架课包')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('接口未返回 JSON，请确认后端服务是否正常')).toHaveCount(0)
})

test('console live smoke: seeded package package-order and account data render through standalone console-api', async ({
  page
}) => {
  await loginAsAdmin(page)

  await page.goto('/packages')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText(seededPackageName)).toBeVisible({ timeout: 15000 })

  await page.goto('/package-orders')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  const packageOrderRow = page.locator('tbody tr').filter({ hasText: seededPackageOrderNo }).first()
  await expect(packageOrderRow).toBeVisible({ timeout: 15000 })
  await packageOrderRow.getByRole('button', { name: '详情' }).click()
  await expect(page.getByRole('heading', { name: '订单详情' })).toBeVisible()
  await expect(page.getByText(seededPackageOrderNo)).toBeVisible()
  await expect(page.getByText(`课包名称：${seededPackageName}`)).toBeVisible()

  await page.goto('/accounts')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByText(seededAccountUsername)).toBeVisible({ timeout: 15000 })
  await expect(
    page.locator('tbody tr').filter({ hasText: seededSuperAdminUsername }).getByRole('cell', { name: 'super_admin' })
  ).toBeVisible()
})

test('console live smoke: logs and package list filters work against standalone console-api', async ({ page }) => {
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

  await page.goto('/packages')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('按课包名称搜索').fill(seededPackageKeyword)
  await page.getByLabel('课包状态').selectOption('active')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page).toHaveURL(/keyword=/)
  await expect(page).toHaveURL(/status=active/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededPackageName }).first()).toBeVisible()

  await page.goto('/package-groups')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('按课包 ID 过滤').fill(seededPackageId)
  await page.getByLabel('拼团状态').selectOption('active')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page).toHaveURL(/package_id=package_seed_active_002/)
  await expect(page).toHaveURL(/status=active/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededPackageGroupId }).first()).toBeVisible()
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
})

test('console live smoke: seeded package can be updated and rolled back through standalone console-api', async ({
  page,
  request
}) => {
  await bootstrapAdminSession(page, request)

  const updatedCoachIntro = '用于验证“去参团”与进行中团详情。（live smoke）'
  const packageForm = page.locator('form').first()

  await page.goto(`/packages/${seededPackageId}/edit`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: '编辑课包' })).toBeVisible()
  await expect(packageForm.getByLabel(/课包名称/)).toHaveValue(seededPackageName)
  await expect(packageForm.getByLabel(/教练简介/)).toHaveValue('用于验证“去参团”与进行中团详情。')

  await packageForm.getByLabel(/教练简介/).fill(updatedCoachIntro)
  await expect(packageForm.getByLabel(/教练简介/)).toHaveValue(updatedCoachIntro)
  await packageForm.getByRole('button', { name: '保存课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededPackageName }).first()).toBeVisible({ timeout: 15000 })

  await page.goto('/logs')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('管理员用户名').fill(seededSuperAdminUsername)
  await page.getByLabel('动作').selectOption('package_update')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page).toHaveURL(/action=package_update/)
  await expect(
    page.locator('tbody tr').filter({ hasText: 'package_update' }).filter({ hasText: seededPackageName }).first()
  ).toBeVisible({ timeout: 15000 })

  await page.goto(`/packages/${seededPackageId}/edit`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(packageForm.getByLabel(/教练简介/)).toHaveValue(updatedCoachIntro)
  await packageForm.getByLabel(/教练简介/).fill('用于验证“去参团”与进行中团详情。')
  await expect(packageForm.getByLabel(/教练简介/)).toHaveValue('用于验证“去参团”与进行中团详情。')
  await packageForm.getByRole('button', { name: '保存课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
})

test('console live smoke: seeded package group and refunded package order are reachable', async ({ page }) => {
  await loginAsAdmin(page)

  await page.goto(`/package-groups?package_id=${seededSuccessPackageId}`)
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('tbody tr').filter({ hasText: seededSuccessPackageName }).first()).toBeVisible({ timeout: 15000 })

  await page.goto('/package-orders')
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  await page.getByPlaceholder('订单号 / 昵称 / 课包名 / 拼团ID').fill(seededFailedPackageOrderNo)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByText('加载中...')).toHaveCount(0, { timeout: 15000 })
  const refundedOrderRow = page.locator('tbody tr').filter({ hasText: seededFailedPackageOrderNo }).first()
  await expect(refundedOrderRow).toBeVisible({ timeout: 15000 })
  await refundedOrderRow.getByRole('button', { name: '详情' }).click()
  await expect(page.getByText(`课包名称：${seededFailedPackageId === 'package_seed_failed_004' ? '[课包回归] 已失败敏捷训练 5 次课' : seededFailedPackageId}`)).toBeVisible()
  await expect(page.getByText('退款类型：系统自动退款')).toBeVisible()
})

