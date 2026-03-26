import { expect, test } from '@playwright/test'

test('frontend home renders course cards and can open a course detail page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('邻动体适能').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '全部课程' })).toBeVisible()
  await expect(page.getByRole('link', { name: /儿童基础体能训练/ })).toBeVisible()

  await page.getByRole('link', { name: /儿童基础体能训练/ }).click()

  await expect(page).toHaveURL(/\/course\/1$/)
  await expect(page.locator('nav').getByRole('heading', { name: '课程详情' })).toBeVisible()
  await expect(page.getByText('拼团规则')).toBeVisible()
  await expect(page.getByRole('button', { name: /立即开团/ })).toBeVisible()
})
