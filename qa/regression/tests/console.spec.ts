import { expect, test, type Route } from '@playwright/test'

const dashboardOverview = {
  range: {
    key: 'today',
    label: '今日',
    days: 1,
    display_text: '2026-04-20（今日）',
    compare_label: '较昨日',
    start_date: '2026-04-20',
    end_date: '2026-04-20'
  },
  metrics: {
    grouping_course_count: { current: 0, previous: null, delta: null, direction: 'none' },
    class_course_count: { current: 0, previous: 0, delta: 0, direction: 'flat' },
    publish_course_count: { current: 0, previous: 0, delta: 0, direction: 'flat' },
    success_group_count: { current: 0, previous: 0, delta: 0, direction: 'flat' },
    group_member_count: { current: 0, previous: 0, delta: 0, direction: 'flat' },
    successful_group_amount: { current: 0, previous: 0, delta: 0, direction: 'flat' }
  },
  anomalies: {
    failed_group_pending_refund_count: 0,
    expired_active_group_count: 0,
    member_mismatch_group_count: 0,
    auto_refund_order_count: 0
  },
  package_metrics: {
    active_package_count: { current: 3, previous: null, delta: null, direction: 'none' },
    created_package_count: { current: 1, previous: 0, delta: 1, direction: 'up' },
    success_group_count: { current: 2, previous: 1, delta: 1, direction: 'up' },
    paid_member_count: { current: 6, previous: 4, delta: 2, direction: 'up' },
    paid_amount: { current: 325500, previous: 198000, delta: 127500, direction: 'up' },
    refunded_order_count: { current: 2, previous: 1, delta: 1, direction: 'up' }
  },
  package_anomalies: {
    failed_group_pending_refund_count: 1,
    expired_active_group_count: 1,
    member_mismatch_group_count: 0,
    auto_refund_order_count: 2
  },
  note: 'Regression mock overview for package group V2.2'
}

const baseAdminUser = {
  id: 'admin-1',
  username: 'regression-admin',
  role: 'super_admin',
  status: 'active'
}

const ADMIN_API_BASE_PATTERN = /http:\/\/127\.0\.0\.1:\d+\/api\/admin/

const fulfillJson = async (route: Route, data: unknown) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization'
      }
    })
    return true
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify({
      code: 0,
      message: 'ok',
      data
    })
  })
  return true
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(user => {
    window.localStorage.setItem('console_admin_token', 'regression-token')
    window.localStorage.setItem('console_admin_user', JSON.stringify(user))
  }, baseAdminUser)

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/dashboard\\/overview.*`), async route => {
    await fulfillJson(route, dashboardOverview)
  })
})

test('console dashboard renders package navigation and overview cards for a signed-in admin', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible()
  await expect(page.getByText('regression-admin / super_admin')).toBeVisible()
  await expect(page.getByRole('link', { name: '课包管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '课包拼团', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '课包订单', exact: true })).toBeVisible()
  await expect(page.getByText('课包经营数据')).toBeVisible()
  await expect(page.getByText('当前上架课包')).toBeVisible()
  await expect(page.getByRole('link', { name: /自动退款/ })).toBeVisible()
})

test('console package create page can submit a new package and redirect back to the list', async ({ page }) => {
  let createPayload: Record<string, unknown> | null = null

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/packages(\\?.*)?$`), async route => {
    await fulfillJson(route, {
      list: [],
      total: 0,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/packages$`), async route => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method !== 'POST') {
      await route.fallback()
      return
    }

    createPayload = route.request().postDataJSON() as Record<string, unknown>
    await fulfillJson(route, { id: 'pkg-created-1' })
  })

  await page.goto('/packages/new')
  const packageForm = page.locator('form').first()

  await packageForm.getByLabel(/课包名称/).fill('[回归] 周末体适能课包')
  await packageForm.getByLabel(/总价（分）/).fill('199800')
  await packageForm.getByLabel(/支持人数/).fill('2, 4, 6')
  await packageForm.getByLabel(/开团截止时长/).fill('48')
  await packageForm.getByLabel(/所在区域/).fill('南山区')
  await packageForm.getByLabel(/小区 \/ 场地名称/).fill('深圳湾社区')
  await packageForm.getByLabel(/详细地点/).fill('会所二楼活动室')
  await packageForm.getByLabel(/^状态/).selectOption('active')
  await packageForm.getByLabel(/经度/).fill('113.9304')
  await packageForm.getByLabel(/纬度/).fill('22.5333')
  await packageForm.getByLabel(/教练姓名/).fill('页面回归教练')
  await packageForm.getByLabel(/封面图 URL/).fill('https://example.com/package-cover.jpg')
  await packageForm.getByLabel(/教练简介/).fill('用于课包页面回归的教练简介')
  await packageForm.getByLabel(/课包介绍/).fill('用于课包运营后台页面回归的介绍文案')

  await packageForm.getByRole('button', { name: '创建课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  expect(createPayload).not.toBeNull()
  expect(createPayload?.name).toBe('[回归] 周末体适能课包')
  expect(createPayload?.total_price_fen).toBe(199800)
  expect(createPayload?.supported_people).toEqual([2, 4, 6])
  expect(createPayload?.status).toBe('active')
})

test('console package edit page can update and view linked package group and order pages', async ({ page }) => {
  const requests: Array<{ method: string; path: string; body: Record<string, unknown> | null }> = []

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/packages\\/pkg-edit-1$`), async route => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'GET') {
      await fulfillJson(route, {
        id: 'pkg-edit-1',
        name: '[回归] 课包编辑页',
        cover: 'https://example.com/package.jpg',
        images: ['https://example.com/package-gallery-1.jpg'],
        total_price_fen: 188800,
        total_price_text: '1888.00',
        supported_people: [2, 4, 8],
        location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
        location_district: '南山区',
        location_community: '深圳湾社区',
        location_detail: '会所二楼活动室',
        coach_name: '回归教练',
        status: 'active',
        deadline_hours: 48,
        create_time: '2026-04-19 10:00:00',
        update_time: '2026-04-19 11:00:00',
        longitude: 113.9304,
        latitude: 22.5333,
        coach_intro: '原始教练简介',
        coach_certificates: ['https://example.com/cert-1.jpg'],
        description: '原始课包介绍'
      })
      return
    }

    requests.push({
      method,
      path: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON() as Record<string, unknown> | null
    })

    await fulfillJson(route, { id: 'pkg-edit-1' })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/packages(\\?.*)?$`), async route => {
    await fulfillJson(route, {
      list: [
        {
          id: 'pkg-edit-1',
          name: '[回归] 课包编辑页',
          cover: 'https://example.com/package.jpg',
          total_price_fen: 188800,
          total_price_text: '1888.00',
          supported_people: [2, 4, 8],
          location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
          location_district: '南山区',
          location_community: '深圳湾社区',
          location_detail: '会所二楼活动室',
          coach_name: '回归教练',
          status: 'active',
          deadline_hours: 48,
          create_time: '2026-04-19 10:00:00',
          update_time: '2026-04-20 10:00:00'
        }
      ],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/package-groups(\\?.*)?$`), async route => {
    await fulfillJson(route, {
      list: [
        {
          id: 'pkg-group-1',
          package_id: 'pkg-edit-1',
          package_name: '[回归] 课包编辑页',
          creator_id: 'user-1',
          status: 'active',
          target_count: 4,
          current_count: 2,
          member_amount_fen: 47200,
          member_amount_text: '472.00',
          deadline: '2026-04-22 12:00:00',
          remaining_seconds: 3600,
          weekday: 6,
          hour: 10,
          schedule_text: '每周六 10:00，共5次',
          first_class_time: null,
          schedule_list: [],
          create_time: '2026-04-20 08:00:00',
          success_time: ''
        }
      ],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/package-orders(\\?.*)?$`), async route => {
    await fulfillJson(route, {
      list: [
        {
          id: 'pkg-order-1',
          order_no: 'LDPKG-EDIT-01',
          user_id: 'user-1',
          nickname: '测试家长',
          phone: '13800000000',
          avatar_url: '',
          package_id: 'pkg-edit-1',
          package_name: '[回归] 课包编辑页',
          package_group_id: 'pkg-group-1',
          package_group_status: 'active',
          amount_fen: 47200,
          amount_text: '472.00',
          status: 'success',
          order_type: 2,
          action: 'start',
          refund_reason: '',
          refund_type: '',
          create_time: '2026-04-20 08:00:00',
          update_time: '2026-04-20 08:05:00',
          pay_time: '2026-04-20 08:05:00',
          refund_time: ''
        }
      ],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.goto('/packages/pkg-edit-1/edit')
  const editForm = page.locator('form').first()

  await editForm.getByLabel(/课包名称/).fill('[回归] 课包编辑页-已更新')
  await editForm.getByLabel(/教练简介/).fill('更新后的课包教练简介')
  await editForm.getByRole('button', { name: '保存课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  expect(requests[0]?.method).toBe('PUT')
  expect(requests[0]?.body?.name).toBe('[回归] 课包编辑页-已更新')

  await page.goto('/packages/pkg-edit-1')
  await page.getByRole('link', { name: '查看拼团' }).click()
  await expect(page).toHaveURL(/\/package-groups\?package_id=pkg-edit-1$/)
  await expect(page.getByText('pkg-group-1')).toBeVisible()

  await page.goto('/packages/pkg-edit-1')
  await page.getByRole('link', { name: '查看订单' }).click()
  await expect(page).toHaveURL(/\/package-orders\?package_id=pkg-edit-1$/)
  await expect(page.getByText('LDPKG-EDIT-01')).toBeVisible()
})

test('console account page can create update and delete an account', async ({ page }) => {
  const accounts = [
    {
      id: 'admin-seed-1',
      username: 'seed-admin',
      role: 'admin',
      status: 'active',
      last_login_time: '',
      create_time: '2026-03-26 23:00:00'
    }
  ]

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/accounts(\\?.*)?$`), async route => {
    const url = new URL(route.request().url())
    const keyword = url.searchParams.get('keyword') || ''
    const list = accounts.filter(item => !keyword || item.username.includes(keyword))
    await fulfillJson(route, {
      list,
      total: list.length,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/accounts$`), async route => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method !== 'POST') {
      await route.fallback()
      return
    }

    const payload = route.request().postDataJSON() as { username: string; role: 'admin' | 'super_admin' }
    accounts.push({
      id: 'admin-created-1',
      username: payload.username,
      role: payload.role,
      status: 'active',
      last_login_time: '',
      create_time: '2026-03-27 00:10:00'
    })

    await fulfillJson(route, { id: 'admin-created-1' })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/accounts\\/.+`), async route => {
    const method = route.request().method()
    const id = new URL(route.request().url()).pathname.split('/').pop() || ''

    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'PUT') {
      const payload = route.request().postDataJSON() as { role?: 'admin' | 'super_admin'; status?: 'active' | 'disabled' }
      const target = accounts.find(item => item.id === id)
      if (target) {
        target.role = payload.role || target.role
        target.status = payload.status || target.status
      }
    }

    if (method === 'DELETE') {
      const targetIndex = accounts.findIndex(item => item.id === id)
      if (targetIndex >= 0) {
        accounts.splice(targetIndex, 1)
      }
    }

    await fulfillJson(route, { id })
  })

  await page.goto('/accounts')
  const accountEditor = page.locator('form').first()

  await page.getByRole('button', { name: '新增账号' }).click()
  await accountEditor.getByLabel('用户名').fill('page_reg_admin')
  await accountEditor.getByPlaceholder('至少 6 位').fill('temp123456')
  await accountEditor.getByPlaceholder('再次输入密码').fill('temp123456')
  await accountEditor.getByRole('button', { name: '保存' }).click()

  await expect(page.getByText('page_reg_admin')).toBeVisible()

  const targetRow = page.locator('tr', { hasText: 'page_reg_admin' })
  await targetRow.getByRole('button', { name: '编辑' }).click()
  await accountEditor.getByLabel('状态').selectOption('disabled')
  await accountEditor.getByPlaceholder('不修改可留空').fill('temp654321')
  await accountEditor.getByPlaceholder('修改密码时需再次输入').fill('temp654321')
  await accountEditor.getByRole('button', { name: '保存' }).click()

  await expect(targetRow.getByText('停用')).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await targetRow.getByRole('button', { name: '删除' }).click()
  await expect(page.getByText('page_reg_admin')).toHaveCount(0)
})

test('console package order page can refund a paid package order and refresh list/detail state', async ({ page }) => {
  const orderState = {
    id: 'package-order-paid-1',
    order_no: 'LDPKG202604200001',
    user_id: 'user-1',
    nickname: '测试家长02',
    phone: '13800000000',
    avatar_url: '',
    package_id: 'pkg-paid-1',
    package_name: '[测试] 深圳宝安体能进阶课包',
    package_group_id: 'pkg-group-paid-1',
    package_group_status: 'active',
    amount_fen: 49500,
    amount_text: '495.00',
    status: 'success',
    order_type: 2,
    action: 'join',
    refund_reason: '',
    refund_type: '',
    create_time: '2026-04-20 09:00:00',
    update_time: '2026-04-20 09:05:00',
    pay_time: '2026-04-20 09:05:00',
    refund_time: ''
  }

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/package-orders(\\?.*)?$`), async route => {
    await fulfillJson(route, {
      list: [orderState],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}\\/package-orders\\/package-order-paid-1\\/refund$`), async route => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    const payload = route.request().postDataJSON() as { reason: string }
    orderState.status = 'refunded'
    orderState.refund_time = '2026-04-20 10:00:00'
    orderState.refund_reason = payload.reason
    orderState.refund_type = 'manual'
    orderState.package_group_status = 'failed'
    orderState.update_time = '2026-04-20 10:00:00'

    await fulfillJson(route, { id: orderState.id })
  })

  await page.goto('/package-orders')

  await expect(page.getByText('LDPKG202604200001')).toBeVisible()
  await page.getByRole('button', { name: '退款' }).click()
  await expect(page.getByText('订单详情')).toBeVisible()
  await page.getByLabel('退款原因').fill('页面回归手动退款')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '执行手动退款' }).click()

  const targetRow = page.locator('tr', { hasText: 'LDPKG202604200001' })
  await expect(targetRow.getByText('已退款')).toBeVisible()
  await expect(targetRow.getByText('手动退款', { exact: true })).toBeVisible()
  await expect(page.getByText('退款原因：页面回归手动退款')).toBeVisible()
  await expect(page.getByText('拼团状态：已失败')).toBeVisible()
})
