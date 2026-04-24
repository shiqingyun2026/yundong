import { expect, test } from '@playwright/test'

test('frontend home renders course cards and can open a course detail page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('邻动体适能')).toBeVisible()
  await expect(page.getByRole('button', { name: '全部课程' })).toBeVisible()
  await expect(page.getByRole('link', { name: /儿童基础体能训练/ }).first()).toBeVisible()

  await page.getByRole('link', { name: /儿童基础体能训练/ }).first().click()

  await expect(page).toHaveURL(/\/course\/1$/)
  await expect(page.locator('nav').getByRole('heading', { name: '课程详情' })).toBeVisible()
  await expect(page.getByText('拼团规则')).toBeVisible()
  await expect(page.getByText('儿童基础体能训练（3-6岁）')).toBeVisible()
  await expect(page.getByRole('button', { name: /去凑团/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /立即开团/ })).toBeVisible()
})

test('frontend course detail can enter payment confirmation flow from join group action', async ({ page }) => {
  await page.goto('/course/1')

  await expect(page.locator('nav').getByRole('heading', { name: '课程详情' })).toBeVisible()
  await page.getByRole('button', { name: /去凑团/ }).click()

  await expect(page).toHaveURL(/\/confirm-payment\/1$/)
  await expect(page.getByRole('heading', { name: '支付确认' })).toBeVisible()
  await expect(page.getByText('待支付总额')).toBeVisible()
  await expect(page.getByText('拼团中')).toBeVisible()
  await expect(page.getByRole('button', { name: /立即支付/ })).toBeVisible()
})

test('frontend my group buys supports tab switching across ongoing completed and failed records', async ({ page }) => {
  await page.goto('/my-group-buys')

  await expect(page.getByRole('heading', { name: '我的拼团' })).toBeVisible()
  await expect(page.getByText('青少年体适能基础课 (周末班)')).toBeVisible()
  await expect(page.getByText('少儿引体向上专项提升课')).toBeVisible()
  await expect(page.getByText('亲子户外趣味体能营 (秋季特辑)')).toBeVisible()

  await page.getByRole('button', { name: '进行中' }).click()
  await expect(page.getByText('青少年体适能基础课 (周末班)')).toBeVisible()
  await expect(page.getByText('少儿引体向上专项提升课')).toHaveCount(0)

  await page.getByRole('button', { name: '已成团' }).click()
  await expect(page.getByText('少儿引体向上专项提升课')).toBeVisible()
  await expect(page.getByText('青少年体适能基础课 (周末班)')).toHaveCount(0)

  await page.getByRole('button', { name: '已失败' }).click()
  await expect(page.getByText('亲子户外趣味体能营 (秋季特辑)')).toBeVisible()
  await expect(page.getByText('少儿引体向上专项提升课')).toHaveCount(0)
})

test('frontend ongoing group record can open group detail page', async ({ page }) => {
  await page.goto('/my-group-buys')

  await page.getByRole('button', { name: '进行中' }).click()
  await page.getByRole('button', { name: '查看详情' }).click()

  await expect(page).toHaveURL(/\/group-buy\/gb1$/)
  await expect(page.getByText('拼团详情')).toBeVisible()
  await expect(page.getByText(/还差 1 人/)).toBeVisible()
  await expect(page.getByText('拼团规则')).toBeVisible()
  await expect(page.getByRole('button', { name: /邀请好友参团/ })).toBeVisible()
})
