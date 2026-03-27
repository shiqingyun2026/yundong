import { expect, test } from '@playwright/test'

const dashboardOverview = {
  range: {
    label: '今日',
    display_text: '2026-03-26',
    compare_label: '较昨日',
    start_date: '2026-03-26',
    end_date: '2026-03-26'
  },
  metrics: {
    grouping_course_count: { current: 6, delta: null, direction: 'flat' },
    class_course_count: { current: 3, delta: 1, direction: 'up' },
    publish_course_count: { current: 2, delta: 0, direction: 'flat' },
    success_group_count: { current: 4, delta: 1, direction: 'up' },
    group_member_count: { current: 18, delta: -2, direction: 'down' },
    successful_group_amount: { current: 2380.5, delta: 120.25, direction: 'up' }
  },
  anomalies: {
    failed_group_pending_refund_count: 1,
    expired_active_group_count: 2,
    member_mismatch_group_count: 1,
    auto_refund_order_count: 3
  },
  note: 'Regression mock overview'
}

const baseAdminUser = {
  id: 'admin-1',
  username: 'regression-admin',
  role: 'super_admin',
  status: 'active'
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('console_admin_token', 'regression-token')
    window.localStorage.setItem(
      'console_admin_user',
      JSON.stringify({
        id: 'admin-1',
        username: 'regression-admin',
        role: 'super_admin',
        status: 'active'
      })
    )
  })

  await page.route('http://127.0.0.1:8000/api/admin/dashboard/overview?range=*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: dashboardOverview
      })
    })
  })
})

test('console dashboard renders navigation and overview cards for a signed-in admin', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: '概览' })).toBeVisible()
  await expect(page.getByText('regression-admin / super_admin')).toBeVisible()
  await expect(page.getByRole('link', { name: '课程管理' })).toBeVisible()
  await expect(page.getByText('数据概括')).toBeVisible()
  await expect(page.getByText('当前拼团中的课程')).toBeVisible()
  await expect(page.getByRole('link', { name: /自动退款/ })).toBeVisible()
})

test('console course create page can submit a new course and redirect back to the list', async ({ page }) => {
  let createPayload: Record<string, unknown> | null = null

  await page.route('http://127.0.0.1:8000/api/admin/courses', async route => {
    if (route.request().method() === 'POST') {
      createPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { id: 'course-created-1' }
        })
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          list: [],
          total: 0,
          total_pages: 1,
          page: 1,
          size: 10
        }
      })
    })
  })

  await page.goto('/courses/new')
  const courseForm = page.locator('form').first()

  await courseForm.getByLabel(/课程名称/).fill('[回归] 页面新建课程')
  await courseForm.getByLabel(/适龄范围/).fill('6-10岁')
  await courseForm.getByLabel(/拼团价/).fill('199')
  await courseForm.getByLabel(/^原价/).fill('299')
  await courseForm.getByLabel(/成团人数要求/).fill('4')
  await courseForm.getByLabel(/最大成团数量/).fill('3')
  await courseForm.getByLabel(/上架时间/).fill('2026-04-10T09:00')
  await courseForm.getByLabel(/上课时间/).fill('2026-04-20T10:00')
  await courseForm.getByLabel(/下课时间/).fill('2026-04-20T11:30')
  await courseForm.getByLabel(/报名截止时间/).fill('2026-04-18T23:59')
  await courseForm.getByLabel(/^区/).selectOption('南山区')
  await courseForm.getByLabel(/详细地点/).fill('深圳市南山区海德二道18号文体中心B馆')
  await courseForm.getByLabel(/经度/).fill('113.9304')
  await courseForm.getByLabel(/纬度/).fill('22.5333')
  await courseForm.getByLabel(/教练姓名/).fill('页面回归教练')
  await courseForm.getByLabel(/封面图 URL/).fill('https://example.com/cover.jpg')
  await courseForm.getByLabel(/教练简介/).fill('用于运营后台页面回归的教练简介')
  await courseForm.getByRole('textbox', { name: /课程介绍/ }).fill('用于运营后台页面回归的课程介绍')
  await courseForm.getByLabel(/拼团规则/).fill('开课前15分钟到场')

  await courseForm.getByRole('button', { name: '保存课程' }).click()

  await expect(page).toHaveURL(/\/courses$/)
  expect(createPayload).not.toBeNull()
  expect(createPayload?.title).toBe('[回归] 页面新建课程')
  expect(createPayload?.location_district).toBe('广东省 / 深圳市 / 南山区')
  expect(createPayload?.target_count).toBe(4)
})

test('console course edit page can update and offline a course', async ({ page }) => {
  const requests: Array<{ method: string; path: string; body: Record<string, unknown> | null }> = []

  await page.route('http://127.0.0.1:8000/api/admin/courses/course-edit-1/offline', async route => {
    requests.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname,
      body: null
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { id: 'course-edit-1' }
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/courses/course-edit-1', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            id: 'course-edit-1',
            title: '[回归] 课程编辑页',
            cover: 'https://example.com/course.jpg',
            description: '原始课程介绍',
            age_range: '6-10岁',
            original_price: 299,
            group_price: 199,
            target_count: 4,
            max_groups: 2,
            publish_time: '2026-04-10 09:00:00',
            unpublish_time: '',
            start_time: '2026-04-20 10:00:00',
            end_time: '2026-04-20 11:30:00',
            location_district: '广东省 / 深圳市 / 南山区',
            location_detail: '深圳市南山区海德二道18号文体中心B馆',
            longitude: 113.9304,
            latitude: 22.5333,
            deadline: '2026-04-18 23:59:00',
            coach_name: '回归教练',
            coach_intro: '原始教练简介',
            coach_cert: ['NASM-CPT'],
            rules: '原始规则',
            status: 0
          }
        })
      })
      return
    }

    requests.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON() as Record<string, unknown> | null
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { id: 'course-edit-1' }
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/courses/course-edit-1/groups', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: []
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/courses?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          list: [],
          total: 0,
          total_pages: 1,
          page: 1,
          size: 10
        }
      })
    })
  })

  await page.goto('/courses/course-edit-1/edit')
  const editForm = page.locator('form').first()

  await editForm.getByLabel(/课程名称/).fill('[回归] 课程编辑页-已更新')
  await editForm.getByLabel(/教练简介/).fill('更新后的教练简介')
  await editForm.getByRole('button', { name: '保存课程' }).click()

  await expect(page).toHaveURL(/\/courses$/)
  expect(requests[0]?.method).toBe('PUT')
  expect(requests[0]?.body?.title).toBe('[回归] 课程编辑页-已更新')

  await page.goto('/courses/course-edit-1')
  await page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '下架' }).click()

  await expect(page).toHaveURL(/\/courses$/)
  expect(requests.some(item => item.path.endsWith('/offline') && item.method === 'PUT')).toBeTruthy()
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

  await page.route('http://127.0.0.1:8000/api/admin/accounts?*', async route => {
    const url = new URL(route.request().url())
    const keyword = url.searchParams.get('keyword') || ''
    const list = accounts.filter(item => !keyword || item.username.includes(keyword))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          list,
          total: list.length,
          total_pages: 1,
          page: 1,
          size: 10
        }
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/accounts', async route => {
    if (route.request().method() !== 'POST') {
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

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { id: 'admin-created-1' }
      })
    })
  })

  await page.route(/http:\/\/127\.0\.0\.1:8000\/api\/admin\/accounts\/.+/, async route => {
    const method = route.request().method()
    const id = new URL(route.request().url()).pathname.split('/').pop() || ''

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

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { id }
      })
    })
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

  await page.on('dialog', dialog => dialog.accept())
  await targetRow.getByRole('button', { name: '删除' }).click()
  await expect(page.getByText('page_reg_admin')).toHaveCount(0)
})

test('console order page can refund a paid order and refresh list/detail state', async ({ page }) => {
  const orderState = {
    id: 'order-paid-1',
    order_no: 'ORD-20260327-0001',
    user_nick_name: '测试家长02',
    course_title: '[测试] 深圳宝安体能进阶·等待上课',
    amount: 199,
    status: 1,
    create_time: '2026-03-27 09:00:00',
    pay_time: '2026-03-27 09:05:00',
    refund_time: '',
    refund_reason: '',
    refund_type: ''
  }

  await page.route('http://127.0.0.1:8000/api/admin/orders?*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          list: [orderState],
          total: 1,
          total_pages: 1,
          page: 1,
          size: 10
        }
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/orders/order-paid-1', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          id: orderState.id,
          order_no: orderState.order_no,
          user: {
            id: 'user-1',
            nick_name: orderState.user_nick_name,
            phone: '',
            avatar_url: ''
          },
          course: {
            id: 'course-1',
            title: orderState.course_title,
            start_time: '2026-04-20 10:00:00',
            end_time: '',
            location_community: '',
            location_detail: '深圳市宝安区体育中心'
          },
          group: {
            id: 'group-1',
            current_count: 3,
            target_count: 3,
            status: 1
          },
          amount: orderState.amount,
          status: orderState.status,
          pay_time: orderState.pay_time,
          refund_time: orderState.refund_time,
          refund_reason: orderState.refund_reason,
          refund_type: orderState.refund_type,
          create_time: orderState.create_time
        }
      })
    })
  })

  await page.route('http://127.0.0.1:8000/api/admin/orders/order-paid-1/refund', async route => {
    const payload = route.request().postDataJSON() as { reason: string }
    orderState.status = 2
    orderState.refund_time = '2026-03-27 10:00:00'
    orderState.refund_reason = payload.reason
    orderState.refund_type = 'manual'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { id: orderState.id }
      })
    })
  })

  await page.goto('/orders')

  await expect(page.getByText('ORD-20260327-0001')).toBeVisible()
  await page.getByRole('button', { name: '退款' }).click()
  await expect(page.getByText('订单详情')).toBeVisible()
  await page.getByPlaceholder('请输入本次手动退款原因').fill('页面回归手动退款')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '确认退款' }).click()

  const targetRow = page.locator('tr', { hasText: 'ORD-20260327-0001' })
  await expect(targetRow.getByText('已退款')).toBeVisible()
  await expect(targetRow.getByRole('cell', { name: '手动退款', exact: true })).toBeVisible()
  await expect(page.getByText('退款原因：页面回归手动退款')).toBeVisible()
  await expect(page.getByText('状态：已退款')).toBeVisible()
})
