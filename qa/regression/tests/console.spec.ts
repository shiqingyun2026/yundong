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

const ADMIN_API_BASE_PATTERN = /\/api\/admin/

const adminApiPattern = (pathPattern: string) =>
  new RegExp(`${ADMIN_API_BASE_PATTERN.source.replace(/\/$/, '')}${pathPattern}`)

const buildCorsHeaders = (route: Route, extra: Record<string, string> = {}) => {
  const origin = route.request().headers().origin || 'http://127.0.0.1:3100'

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-credentials': 'true',
    ...extra
  }
}

const fulfillJson = async (route: Route, data: unknown, headers: Record<string, string> = {}) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: buildCorsHeaders(route)
    })
    return true
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: buildCorsHeaders(route, headers),
    body: JSON.stringify({
      code: 0,
      message: 'ok',
      data
    })
  })
  return true
}

const fulfillError = async (
  route: Route,
  status: number,
  code: number,
  message: string,
  headers: Record<string, string> = {}
) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: buildCorsHeaders(route)
    })
    return true
  }

  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: buildCorsHeaders(route, headers),
    body: JSON.stringify({
      code,
      message,
      data: null
    })
  })
  return true
}

const bootstrapSession = async (
  page: import('@playwright/test').Page,
  user: typeof baseAdminUser = baseAdminUser
) => {
  await page.goto('/login')
  await page.evaluate(sessionUser => {
    window.localStorage.setItem('console_admin_user', JSON.stringify(sessionUser))
  }, user)
}

test.beforeEach(async ({ page }) => {
  await page.route(adminApiPattern('\\/dashboard\\/overview.*'), async route => {
    await fulfillJson(route, dashboardOverview)
  })

  await page.route(adminApiPattern('\\/login\\/session$'), async route => {
    await fulfillJson(route, {
      user: baseAdminUser
    })
  })

  await page.route(adminApiPattern('\\/login\\/logout$'), async route => {
    await fulfillJson(route, {})
  })

  await page.route(adminApiPattern('\\/packages\\/location-suggestions\\?.*$'), async route => {
    await fulfillJson(route, {
      list: []
    })
  })
})

test('console dashboard renders package navigation and overview cards for a signed-in admin', async ({ page }) => {
  await bootstrapSession(page)
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
  await bootstrapSession(page)
  let createPayload: Record<string, unknown> | null = null

  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [],
      total: 0,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(adminApiPattern('\\/packages$'), async route => {
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
  await packageForm.getByLabel(/适用年龄/).fill('4-8岁')
  await packageForm.getByLabel(/课程节数/).fill('10')
  await packageForm.getByLabel(/单节课时长（分钟）/).fill('90')
  await expect(packageForm.getByLabel(/开团截止时长/)).toHaveValue('48')
  await packageForm.getByLabel(/^区/).selectOption('南山区')
  await packageForm.getByLabel(/小区 \/ 场地名称/).fill('深圳湾社区')
  await packageForm.getByLabel(/详细地点/).fill('会所二楼活动室')
  await packageForm.getByLabel(/上架时间/).fill('2026-04-22T10:00')
  await packageForm.getByLabel(/经度/).fill('113.9304')
  await packageForm.getByLabel(/纬度/).fill('22.5333')
  await packageForm.getByLabel(/封面图 URL/).fill('https://example.com/package-cover.jpg')
  await packageForm.getByRole('button', { name: '新增团型' }).click()
  await packageForm.getByLabel(/团型人数/).fill('4')
  await packageForm.getByLabel(/人均售价（分）/).fill('49950')
  await packageForm.locator('textarea').nth(0).fill('用于课包页面回归的教练简介')
  await packageForm.locator('textarea').nth(2).fill('用于课包运营后台页面回归的介绍文案')

  await packageForm.getByRole('button', { name: '创建课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  expect(createPayload).not.toBeNull()
  expect(createPayload?.name).toBe('[回归] 周末体适能课包')
  expect(createPayload?.age_range).toBe('4-8岁')
  expect(createPayload?.class_count).toBe(10)
  expect(createPayload?.class_duration_minutes).toBe(90)
  expect(createPayload?.supported_people).toEqual([4])
  expect(createPayload?.group_price_config).toEqual([{ target_count: 4, price_fen: 49950 }])
})

test('console login page shows backend error when credentials are rejected', async ({ page }) => {
  await page.context().clearCookies()
  await page.route(adminApiPattern('\\/login\\/session$'), async route => {
    await fulfillError(route, 401, 1002, 'token无效或过期')
  })

  await page.route(adminApiPattern('\\/login$'), async route => {
    await fulfillError(route, 200, 1001, '用户名或密码错误')
  })

  await page.goto('/login')

  await page.getByLabel('用户名').fill('bad-admin')
  await page.getByLabel('密码').fill('bad-password')
  await page.getByRole('button', { name: '进入后台' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('用户名或密码错误')).toBeVisible()
})

test('console package create page shows validation error when group pricing is missing', async ({ page }) => {
  await bootstrapSession(page)
  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [],
      total: 0,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.goto('/packages/new')
  const packageForm = page.locator('form').first()

  await packageForm.getByLabel(/课包名称/).fill('[回归] 缺少团型售价')
  await packageForm.getByLabel(/适用年龄/).fill('4-8岁')
  await packageForm.getByLabel(/课程节数/).fill('8')
  await packageForm.getByLabel(/单节课时长（分钟）/).fill('60')
  await packageForm.getByLabel(/^区/).selectOption('南山区')
  await packageForm.getByLabel(/小区 \/ 场地名称/).fill('深圳湾社区')
  await packageForm.getByLabel(/详细地点/).fill('活动中心')
  await packageForm.getByLabel(/上架时间/).fill('2026-04-22T10:00')
  await packageForm.getByLabel(/封面图 URL/).fill('https://example.com/package-cover.jpg')
  await packageForm.getByRole('button', { name: '创建课包' }).click()

  await expect(page).toHaveURL(/\/packages\/new$/)
  await expect(page.getByText('请至少配置一个团型售价')).toBeVisible()
})

test('console package edit page can update a pending package and view linked package group and order pages', async ({ page }) => {
  await bootstrapSession(page)
  const requests: Array<{ method: string; path: string; body: Record<string, unknown> | null }> = []

  await page.route(adminApiPattern('\\/packages\\/pkg-edit-1$'), async route => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'GET') {
      await fulfillJson(route, {
        id: 'pkg-edit-1',
        name: '[回归] 课包编辑页',
        age_range: '4-8岁',
        cover: 'https://example.com/package.jpg',
        images: ['https://example.com/package-gallery-1.jpg'],
        class_count: 5,
        class_duration_minutes: 60,
        group_price_config: [{ target_count: 4, price_fen: 47200 }],
        supported_people: [2, 4, 8],
        location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
        location_district: '南山区',
        location_community: '深圳湾社区',
        location_detail: '会所二楼活动室',
        coach_name: '回归教练',
        status: 'pending',
        deadline_hours: 48,
        publish_time: '2026-04-19 09:00:00',
        unpublish_time: '',
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

  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [
        {
          id: 'pkg-edit-1',
          name: '[回归] 课包编辑页',
          cover: 'https://example.com/package.jpg',
          group_price_config: [{ target_count: 4, price_fen: 47200 }],
          supported_people: [4],
          location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
          location_district: '南山区',
          location_community: '深圳湾社区',
          location_detail: '会所二楼活动室',
          coach_name: '回归教练',
          status: 'pending',
          deadline_hours: 48,
          publish_time: '2026-04-19 09:00:00',
          unpublish_time: '',
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

  await page.route(adminApiPattern('\\/package-groups(\\?.*)?$'), async route => {
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

  await page.route(adminApiPattern('\\/package-orders(\\?.*)?$'), async route => {
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
  await editForm.locator('textarea').nth(0).fill('更新后的课包教练简介')
  await editForm.getByRole('button', { name: '保存课包' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  expect(requests[0]?.method).toBe('PUT')
  expect(requests[0]?.body?.name).toBe('[回归] 课包编辑页-已更新')

  await page.goto('/packages/pkg-edit-1')
  await page.locator('.page-actions').getByRole('link', { name: '查看拼团' }).click()
  await expect(page).toHaveURL(/\/package-groups\?package_id=pkg-edit-1$/)
  await expect(page.getByText('pkg-group-1')).toBeVisible()

  await page.goto('/packages/pkg-edit-1')
  await page.locator('.page-actions').getByRole('link', { name: '查看订单' }).click()
  await expect(page).toHaveURL(/\/package-orders\?package_id=pkg-edit-1$/)
  await expect(page.getByText('LDPKG-EDIT-01')).toBeVisible()
})

test('console active package pages hide edit entry and list location only shows district plus community', async ({ page }) => {
  await bootstrapSession(page)

  await page.route(adminApiPattern('\\/packages\\/pkg-active-1$'), async route => {
    await fulfillJson(route, {
      id: 'pkg-active-1',
      name: '[回归] 已上架课包',
      age_range: '4-8岁',
      cover: 'https://example.com/package-active.jpg',
      images: ['https://example.com/package-active.jpg'],
      class_count: 5,
      class_duration_minutes: 60,
      group_price_config: [{ target_count: 4, price_fen: 47200 }],
      supported_people: [4],
      location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
      location_district: '南山区',
      location_community: '深圳湾社区',
      location_detail: '会所二楼活动室',
      coach_name: '回归教练',
      status: 'active',
      deadline_hours: 48,
      publish_time: '2026-04-19 09:00:00',
      unpublish_time: '',
      create_time: '2026-04-19 10:00:00',
      update_time: '2026-04-19 11:00:00',
      longitude: 113.9304,
      latitude: 22.5333,
      coach_intro: '原始教练简介',
      coach_certificates: [],
      description: '原始课包介绍'
    })
  })

  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [
        {
          id: 'pkg-active-1',
          name: '[回归] 已上架课包',
          cover: 'https://example.com/package-active.jpg',
          group_price_config: [{ target_count: 4, price_fen: 47200 }],
          supported_people: [4],
          location_text: '南山区 / 深圳湾社区 / 会所二楼活动室',
          location_district: '南山区',
          location_community: '深圳湾社区',
          location_detail: '会所二楼活动室',
          coach_name: '回归教练',
          status: 'active',
          deadline_hours: 48,
          publish_time: '2026-04-19 09:00:00',
          unpublish_time: '',
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

  await page.goto('/packages')
  const targetRow = page.locator('tr', { hasText: '[回归] 已上架课包' })
  await expect(targetRow.getByRole('cell', { name: '南山区 / 深圳湾社区' })).toBeVisible()
  await expect(targetRow.getByRole('link', { name: '编辑' })).toHaveCount(0)

  await page.goto('/packages/pkg-active-1')
  await expect(page.getByRole('link', { name: '编辑' })).toHaveCount(0)
})

test('console account page can create update and delete an account', async ({ page }) => {
  await bootstrapSession(page)
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

  await page.route(adminApiPattern('\\/accounts(\\?.*)?$'), async route => {
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

  await page.route(adminApiPattern('\\/accounts$'), async route => {
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

  await page.route(adminApiPattern('\\/accounts\\/.+'), async route => {
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
  await bootstrapSession(page)
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

  await page.route(adminApiPattern('\\/package-orders(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [orderState],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(adminApiPattern('\\/package-orders\\/package-order-paid-1\\/refund$'), async route => {
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

test('console banner list page can query create and edit banners', async ({ page }) => {
  await bootstrapSession(page)
  const banners = [
    {
      id: 'banner-seed-1',
      image_url: 'https://example.com/banner-seed-1.png',
      title: '首页春季活动',
      kicker: '限时推荐',
      description: '春季活动 Banner',
      jump_type: 'packageDetail',
      jump_target: 'package_seed_active_002',
      sort: 10,
      online_time: '2026-04-22 09:00:00',
      offline_time: '2026-04-30 23:00:00',
      city_codes: ['全国'],
      enabled: false,
      status: 'pending'
    }
  ]

  await page.route(adminApiPattern('\\/banners(\\?.*)?$'), async route => {
    const method = route.request().method()

    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      banners.push({
        id: 'banner-created-1',
        image_url: String(payload.image_url || ''),
        title: String(payload.title || ''),
        kicker: String(payload.kicker || ''),
        description: String(payload.description || ''),
        jump_type: String(payload.jump_type || 'none'),
        jump_target: String(payload.jump_target || ''),
        sort: Number(payload.sort || 0),
        online_time: String(payload.online_time || ''),
        offline_time: String(payload.offline_time || ''),
        city_codes: Array.isArray(payload.city_codes) ? (payload.city_codes as string[]) : ['全国'],
        enabled: false,
        status: 'pending'
      })

      await fulfillJson(route, { id: 'banner-created-1' })
      return
    }

    const url = new URL(route.request().url())
    const keyword = url.searchParams.get('keyword') || ''
    const status = url.searchParams.get('status') || ''
    const list = banners.filter(item => {
      if (keyword && !`${item.title} ${item.kicker} ${item.jump_target}`.includes(keyword)) {
        return false
      }
      if (status && item.status !== status) {
        return false
      }
      return true
    })

    await fulfillJson(route, {
      list,
      total: list.length,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(adminApiPattern('\\/banners\\/.+'), async route => {
    const method = route.request().method()
    const id = new URL(route.request().url()).pathname.split('/').pop() || ''
    const target = banners.find(item => item.id === id)

    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'GET') {
      await fulfillJson(route, target || banners[0])
      return
    }

    if (method === 'PUT' && target) {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      Object.assign(target, {
        title: String(payload.title || target.title),
        jump_type: String(payload.jump_type || target.jump_type),
        jump_target: String(payload.jump_target || target.jump_target),
        sort: Number(payload.sort ?? target.sort),
        online_time: String(payload.online_time || target.online_time),
        offline_time: String(payload.offline_time || target.offline_time),
        status: target.status
      })
      await fulfillJson(route, target)
      return
    }

    await route.fallback()
  })

  await page.route(adminApiPattern('\\/upload\\/image$'), async route => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    const payload = route.request().postDataJSON() as { folder: string; filename: string }
    await fulfillJson(route, {
      public_url: `https://example.com/uploads/${payload.folder}/${payload.filename}`
    })
  })

  await page.goto('/banners')
  await expect(page.getByText('首页春季活动')).toBeVisible()
  await page.getByPlaceholder('按标题 / 跳转目标搜索').fill('春季')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page).toHaveURL(/keyword=%E6%98%A5%E5%AD%A3/)
  await expect(page.getByText('首页春季活动')).toBeVisible()

  await page.getByRole('link', { name: '新建' }).click()
  await expect(page.getByRole('heading', { name: '新建 Banner' })).toBeVisible()
  await expect(page.getByText('排序（数字越小，越靠前）')).toBeVisible()
  await expect(page.getByText('状态')).toHaveCount(0)
  await page.getByLabel('Banner 标题').fill('首页夏季活动')
  await page.getByLabel('跳转类型').selectOption('customUrl')
  await page.getByLabel('跳转目标').fill('https://example.com/summer')
  await page.getByLabel('排序（数字越小，越靠前）').fill('20')
  await page.getByLabel('上线时间').fill('2026-05-01T09:00')
  await page.getByLabel('下线时间').fill('2026-05-31T23:00')
  await page.getByLabel('上传图片').setInputFiles({
    name: 'banner-create.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-banner-image')
  })
  await expect(page.getByRole('img', { name: 'Banner' })).toBeVisible()
  await page.locator('form').getByRole('button', { name: '保存' }).click()

  await expect(page).toHaveURL(/\/banners\/banner-created-1$/)
  await expect(page.getByRole('heading', { name: 'Banner 详情' })).toBeVisible()
  await expect(page.getByLabel('上线时间')).toHaveValue('2026-05-01T09:00')
  await expect(page.getByLabel('下线时间')).toHaveValue('2026-05-31T23:00')

  await page.getByRole('link', { name: '编辑 Banner' }).click()
  await expect(page.getByLabel('上线时间')).toHaveValue('2026-05-01T09:00')
  await expect(page.getByLabel('下线时间')).toHaveValue('2026-05-31T23:00')
  await expect(page.getByText('排序（数字越小，越靠前）')).toBeVisible()
  await expect(page.getByText('状态')).toHaveCount(0)
  await page.getByLabel('Banner 标题').fill('首页夏季活动-已更新')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page).toHaveURL(/\/banners\/banner-created-1$/)
  await expect(page.getByLabel('Banner 标题')).toHaveValue('首页夏季活动-已更新')
})

test('console banner create page shows backend save error', async ({ page }) => {
  await bootstrapSession(page)
  await page.route(adminApiPattern('\\/banners$'), async route => {
    const method = route.request().method()

    if (method === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    if (method === 'POST') {
      await fulfillError(route, 200, 5000, 'Banner 保存失败，请稍后重试')
      return
    }

    await fulfillJson(route, {
      list: [],
      total: 0,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(adminApiPattern('\\/upload\\/image$'), async route => {
    await fulfillJson(route, {
      public_url: 'https://example.com/banner-uploaded.png'
    })
  })

  await page.goto('/banners/new')
  await page.getByLabel('Banner 标题').fill('首页活动 Banner')
  await page.getByLabel('跳转类型').selectOption('none')
  await page.getByLabel('上线时间').fill('2026-04-30T10:00')

  await page.setInputFiles('input[type="file"]', {
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-banner-image')
  })

  await expect(page.getByText('排序（数字越小，越靠前）')).toBeVisible()
  await expect(page.getByText('状态')).toHaveCount(0)
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page).toHaveURL(/\/banners\/new$/)
  await expect(page.getByText('Banner 保存失败，请稍后重试')).toBeVisible()
})

test('console package edit page can offline a package and return to the list', async ({ page }) => {
  await bootstrapSession(page)
  const packageState = {
    id: 'pkg-offline-1',
    name: '[回归] 待下架课包',
    age_range: '4-8岁',
    cover: 'https://example.com/package-offline.jpg',
    images: ['https://example.com/package-offline.jpg'],
    class_count: 6,
    class_duration_minutes: 60,
    group_price_config: [{ target_count: 4, price_fen: 38800 }],
    supported_people: [4],
    location_text: '南山区 / 科技园社区 / 活动中心',
    location_district: '南山区',
    location_community: '科技园社区',
    location_detail: '活动中心',
    coach_name: '下架教练',
    status: 'active',
    deadline_hours: 48,
    publish_time: '2026-04-20 09:00:00',
    unpublish_time: '',
    create_time: '2026-04-20 10:00:00',
    update_time: '2026-04-20 11:00:00',
    longitude: 113.93,
    latitude: 22.53,
    coach_intro: '待下架教练简介',
    coach_certificates: [],
    description: '待下架课包介绍'
  }

  await page.route(adminApiPattern('\\/packages\\/pkg-offline-1$'), async route => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, packageState)
      return
    }

    await route.fallback()
  })

  await page.route(adminApiPattern('\\/packages\\/pkg-offline-1\\/offline$'), async route => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    packageState.status = 'inactive'
    packageState.unpublish_time = '2026-04-22 10:00:00'
    await fulfillJson(route, { id: packageState.id })
  })

  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [packageState],
      total: 1,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.goto('/packages/pkg-offline-1/edit')
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('如有进行中的拼团，将自动扭转拼团状态为失败，并退款')
    dialog.accept()
  })
  await page.getByRole('button', { name: '下架' }).click()

  await expect(page).toHaveURL(/\/packages$/)
  const targetRow = page.locator('tr', { hasText: '[回归] 待下架课包' })
  await expect(targetRow).toBeVisible()
  await expect(targetRow.getByRole('cell', { name: '已下架' })).toBeVisible()
})

test('console package create page can upload cover image through proxy upload API', async ({ page }) => {
  await bootstrapSession(page)
  await page.route(adminApiPattern('\\/packages(\\?.*)?$'), async route => {
    await fulfillJson(route, {
      list: [],
      total: 0,
      total_pages: 1,
      page: 1,
      size: 10
    })
  })

  await page.route(adminApiPattern('\\/upload\\/image$'), async route => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillJson(route, {})
      return
    }

    const payload = route.request().postDataJSON() as { folder: string; filename: string }
    await fulfillJson(route, {
      public_url: `https://example.com/uploads/${payload.folder}/${payload.filename}`
    })
  })

  await page.goto('/packages/new')
  await expect(page.getByLabel(/封面图 URL/)).toHaveValue('')

  await page.locator('label.file-button input[type="file"]').first().setInputFiles({
    name: 'package-cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-image-content')
  })

  await expect(page.getByLabel(/封面图 URL/)).toHaveValue('https://example.com/uploads/course-cover/package-cover.png')
  await expect(page.getByRole('img', { name: '课包封面' })).toBeVisible()
})

test('console non-super-admin user cannot access accounts page and does not see accounts nav', async ({ page }) => {
  const operatorUser = {
    id: 'admin-2',
    username: 'operator-user',
    role: 'admin',
    status: 'active'
  }

  await page.route(adminApiPattern('\\/login\\/session$'), async route => {
    await fulfillJson(route, {
      user: operatorUser
    })
  })

  await bootstrapSession(page, operatorUser)
  await page.goto('/dashboard')
  await expect(page.getByText('operator-user / admin')).toBeVisible()
  await expect(page.getByRole('link', { name: '账号管理' })).toHaveCount(0)

  await page.goto('/accounts')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible()
})
