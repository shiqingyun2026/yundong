# 体验课拼团 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有课包拼团体系中新增 `体验课` 类型，支持首页独立 tab 展示、开团时选择 `上课日期 + 开始时间`，并保证日期最早为开团后第 2 天，正式课现有链路不回归。

**Architecture:** 继续复用现有 `package -> package group -> order` 主链路，不新建独立体验课模型。前端通过 `isTrialPackage` 分支切换首页筛选、详情文案和开团表单；后端继续复用 `/api/package-orders/start`，按课包类型分支校验和生成单节排课；后台课包配置新增 `体验课` 分类并锁定 `class_count = 1`。

**Tech Stack:** 微信小程序原生 `WXML/WXSS/JavaScript`、Node.js/Express、MySQL repository/shared service、React 19 + TypeScript 后台、现有 Node 测试与页面断言测试

---

## File Map

### Miniprogram

- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/course/detail/index.js`
- Modify: `miniprogram/pages/course/detail/index.wxml`
- Modify: `miniprogram/pages/package/start/index.js`
- Modify: `miniprogram/pages/package/start/index.wxml`
- Modify: `miniprogram/pages/payment/result/index.js`
- Modify: `miniprogram/pages/payment/result/index.wxml`
- Modify: `miniprogram/pages/group/detail/index.js`
- Modify: `miniprogram/pages/group/detail/index.wxml`
- Modify: `miniprogram/utils/package.js`
- Create or Modify: `miniprogram/tests/trial-package-home-tab.test.cjs`
- Create or Modify: `miniprogram/tests/trial-package-start-page.test.cjs`
- Create or Modify: `miniprogram/tests/trial-package-start-submit.test.cjs`

### Backend

- Modify: `backend/lindong-api/shared/services/packageOrders.js`
- Modify: `backend/lindong-api/shared/services/packageReaders.js`
- Modify: `backend/lindong-api/routes/package-orders.js`
- Modify: `backend/console-api-service/shared/services/packageOrders.js`
- Modify: `backend/console-api-service/shared/services/packageReaders.js`
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/console-api/services/packageServiceHelpers.js` if class count/category validation is centralized there
- Create or Modify: backend tests nearest to package order / package admin services

### Console

- Modify: `console/src/pages/PackageFormPage.tsx`
- Modify: `console/src/pages/PackageListPage.tsx`
- Modify: `console/src/types.ts`

### Docs

- Modify if implementation diverges: `docs/superpowers/specs/2026-06-02-trial-package-group-buy-design.md`

---

### Task 1: Lock Down Trial Package Configuration In Console/Admin

**Files:**
- Modify: `console/src/pages/PackageFormPage.tsx`
- Modify: `console/src/pages/PackageListPage.tsx`
- Modify: `console/src/types.ts`
- Modify: `backend/console-api-service/console-api/services/packageAdminService.js`
- Modify: `backend/console-api-service/console-api/services/packageServiceHelpers.js`
- Test: existing console/admin package tests or add a focused service assertion near package admin tests

- [ ] **Step 1: Write the failing admin validation test**

```js
it('forces class_count to 1 for trial packages', async () => {
  const payload = {
    name: '周末体验课',
    package_category: '体验课',
    class_count: 5
  }

  await expect(createOrUpdatePackage(payload)).resolves.toMatchObject({
    package_category: '体验课',
    class_count: 1
  })
})
```

- [ ] **Step 2: Run the focused admin test to verify it fails**

Run: `cd /Users/yun/lindong/backend && npm test -- packageAdmin`
Expected: FAIL because `体验课` is not yet a supported category or `class_count` is not normalized to `1`

- [ ] **Step 3: Implement minimal backend normalization for trial packages**

```js
const isTrialPackageCategory = value => `${value || ''}`.trim() === '体验课'

const normalizeClassCountByCategory = payload => {
  if (isTrialPackageCategory(payload.package_category || payload.packageCategory)) {
    return 1
  }

  return Number(payload.class_count)
}

const classCount = normalizeClassCountByCategory(payload)
```

- [ ] **Step 4: Update console form and list filters**

```tsx
const PACKAGE_CATEGORY_OPTIONS = ['体适能', '跳绳', '体验课']

const isTrialPackage = form.package_category === '体验课'

<input
  value={isTrialPackage ? '1' : form.class_count}
  disabled={isTrialPackage}
/>
```

- [ ] **Step 5: Run tests and build checks**

Run: `cd /Users/yun/lindong/console && npm run lint`
Expected: PASS

Run: `cd /Users/yun/lindong/backend && npm test -- packageAdmin`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add console/src/pages/PackageFormPage.tsx console/src/pages/PackageListPage.tsx console/src/types.ts backend/console-api-service/console-api/services/packageAdminService.js backend/console-api-service/console-api/services/packageServiceHelpers.js
git commit -m "feat: support trial package configuration"
```

### Task 2: Add Trial Package Filtering And Trial-Aware Copy In Miniprogram

**Files:**
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/course/detail/index.js`
- Modify: `miniprogram/pages/course/detail/index.wxml`
- Modify: `miniprogram/utils/package.js`
- Test: `miniprogram/tests/trial-package-home-tab.test.cjs`

- [ ] **Step 1: Write the failing miniprogram home-tab test**

```js
const fs = require('fs')
const source = fs.readFileSync('miniprogram/pages/home/index.js', 'utf8')

assert.match(source, /label:\s*'体验课'/)
assert.match(source, /packageCategory === '体验课'/)
```

- [ ] **Step 2: Run the focused home-tab test to verify it fails**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-home-tab.test.cjs`
Expected: FAIL because the `体验课` tab and filter branch do not yet exist

- [ ] **Step 3: Implement home tab and trial package list presentation**

```js
const HOME_TABS = [
  { key: 'all', label: '全部课程' },
  { key: 'fitness', label: '体适能', category: '体适能' },
  { key: 'trial', label: '体验课', category: '体验课' },
  { key: 'jump_rope', label: '跳绳', category: '跳绳' }
]

if (activeTab === 'trial') {
  return source.filter(item => item.packageCategory === '体验课')
}
```

- [ ] **Step 4: Update detail-page copy to branch on trial packages**

```js
const isTrialPackage =
  !!packageDetail && ((packageDetail.packageType || '') === 'trial' || packageDetail.packageCategory === '体验课')

this.setData({
  packageDetail,
  isTrialPackage
})
```

```xml
<view class="section-title">{{isTrialPackage ? '体验课拼团说明' : '拼团说明'}}</view>
<view class="notice-text">
  {{isTrialPackage ? '成团后按所选日期与时间上课。' : '满员即成团，可选择当前进行中的拼团直接加入。'}}
</view>
```

- [ ] **Step 5: Run the focused miniprogram test**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-home-tab.test.cjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/home/index.js miniprogram/pages/home/index.wxml miniprogram/pages/course/detail/index.js miniprogram/pages/course/detail/index.wxml miniprogram/utils/package.js miniprogram/tests/trial-package-home-tab.test.cjs
git commit -m "feat: show trial packages in miniprogram"
```

### Task 3: Split Package Start Page Into Formal-Class And Trial-Class Flows

**Files:**
- Modify: `miniprogram/pages/package/start/index.js`
- Modify: `miniprogram/pages/package/start/index.wxml`
- Modify: `miniprogram/utils/package.js`
- Test: `miniprogram/tests/trial-package-start-page.test.cjs`

- [ ] **Step 1: Write the failing start-page rendering test**

```js
const fs = require('fs')
const wxml = fs.readFileSync('miniprogram/pages/package/start/index.wxml', 'utf8')

assert.match(wxml, /选择上课日期/)
assert.match(wxml, /最早可选日期为开团后第 2 天/)
assert.doesNotMatch(wxml, /体验课仅 1 节.*每周上课时间/s)
```

- [ ] **Step 2: Run the focused start-page test to verify it fails**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-start-page.test.cjs`
Expected: FAIL because the page still only renders `星期 + 上课时间`

- [ ] **Step 3: Introduce a trial-package branch in page state**

```js
const isTrialPackage =
  !!packageDetail && ((packageDetail.packageType || '') === 'trial' || packageDetail.packageCategory === '体验课')

this.setData({
  packageDetail,
  isTrialPackage,
  minTrialClassDate: buildMinTrialClassDate(),
  selectedClassDate: buildMinTrialClassDate()
})
```

- [ ] **Step 4: Replace weekly selectors with date-plus-hour selectors for trial packages**

```xml
<block wx:if="{{isTrialPackage}}">
  <view class="section-title">选择上课日期</view>
  <picker mode="date" start="{{minTrialClassDate}}" value="{{selectedClassDate}}" bindchange="handleClassDateChange">
    <view class="start-form-value">{{selectedClassDate}}</view>
  </picker>
</block>

<block wx:else>
  <view class="section-title">选择每周上课时间</view>
</block>
```

- [ ] **Step 5: Keep hour options shared with formal classes**

```js
const hourOptions = START_HOUR_OPTIONS.map(hour => ({
  value: hour,
  label: `${hour}`.padStart(2, '0') + ':00'
}))
```

- [ ] **Step 6: Run the focused start-page test**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-start-page.test.cjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add miniprogram/pages/package/start/index.js miniprogram/pages/package/start/index.wxml miniprogram/utils/package.js miniprogram/tests/trial-package-start-page.test.cjs
git commit -m "feat: add trial package start form"
```

### Task 4: Extend Package Order Creation To Validate Trial Package Inputs

**Files:**
- Modify: `backend/lindong-api/routes/package-orders.js`
- Modify: `backend/lindong-api/shared/services/packageOrders.js`
- Modify: `backend/console-api-service/shared/services/packageOrders.js`
- Modify: `miniprogram/pages/package/start/index.js`
- Modify: `miniprogram/utils/package.js`
- Test: backend package-order tests and `miniprogram/tests/trial-package-start-submit.test.cjs`

- [ ] **Step 1: Write the failing service-level test for trial package start**

```js
it('rejects trial package classDate earlier than start plus two days', async () => {
  await expect(
    createPackageStartOrder({
      packageId: 'pkg-trial-1',
      targetCount: 4,
      classDate: '2026-06-03',
      hour: 9
    })
  ).rejects.toThrow('上课日期不能早于开团后第2天')
})
```

- [ ] **Step 2: Run focused package-order tests to verify failure**

Run: `cd /Users/yun/lindong/backend && npm test -- packageOrders`
Expected: FAIL because the service does not yet recognize `classDate` for trial packages

- [ ] **Step 3: Implement trial package input branching in miniprogram submit payload**

```js
const payload = this.data.isTrialPackage
  ? {
      packageId: this.data.packageId,
      targetCount: this.data.selectedTargetCount,
      classDate: this.data.selectedClassDate,
      hour: this.data.selectedHour,
      childNickname: this.data.childNickname.trim(),
      childAge: this.data.childAge,
      parentMobile: this.data.parentMobile
    }
  : {
      packageId: this.data.packageId,
      targetCount: this.data.selectedTargetCount,
      weekday: this.data.selectedWeekday,
      hour: this.data.selectedHour,
      childNickname: this.data.childNickname.trim(),
      childAge: this.data.childAge,
      parentMobile: this.data.parentMobile
    }
```

- [ ] **Step 4: Implement shared backend validation and schedule creation**

```js
if (isTrialPackage) {
  ensureCondition(classDate, { message: '请选择上课日期' })
  ensureCondition(Number.isInteger(hour) && hour >= 9 && hour <= 19, { message: '请选择合法的开始时间' })
  ensureCondition(isDateAtLeastTwoDaysAfterNow(classDate, now), { message: '上课日期不能早于开团后第2天' })

  scheduleList = [
    {
      index: 1,
      class_time: `${classDate} ${String(hour).padStart(2, '0')}:00:00`
    }
  ]
}
```

- [ ] **Step 5: Mirror the same validation in both backend shared services**

```js
module.exports = {
  createPackageStartOrder,
  // keep lindong-api and console-api-service implementations structurally identical
}
```

- [ ] **Step 6: Run focused tests**

Run: `cd /Users/yun/lindong/backend && npm test -- packageOrders`
Expected: PASS

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-start-submit.test.cjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/lindong-api/routes/package-orders.js backend/lindong-api/shared/services/packageOrders.js backend/console-api-service/shared/services/packageOrders.js miniprogram/pages/package/start/index.js miniprogram/utils/package.js miniprogram/tests/trial-package-start-submit.test.cjs
git commit -m "feat: validate and create trial package group orders"
```

### Task 5: Read And Display Trial Schedule Data Across Group/Payment Flows

**Files:**
- Modify: `backend/lindong-api/shared/services/packageReaders.js`
- Modify: `backend/console-api-service/shared/services/packageReaders.js`
- Modify: `miniprogram/pages/group/detail/index.js`
- Modify: `miniprogram/pages/group/detail/index.wxml`
- Modify: `miniprogram/pages/payment/result/index.js`
- Modify: `miniprogram/pages/payment/result/index.wxml`
- Test: update nearest existing payment/group detail assertions

- [ ] **Step 1: Write the failing display test**

```js
const fs = require('fs')
const groupDetailWxml = fs.readFileSync('miniprogram/pages/group/detail/index.wxml', 'utf8')

assert.match(groupDetailWxml, /上课日期|上课时间|scheduleText/)
```

- [ ] **Step 2: Run the display test to verify it fails or is incomplete**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-group-detail.test.cjs`
Expected: FAIL or insufficient assertions for trial schedule presentation

- [ ] **Step 3: Ensure reader payloads expose trial schedule consistently**

```js
return {
  schedule_mode: isTrialPackage ? 'single_session' : scheduleMode,
  schedule_text: isTrialPackage ? formatTrialScheduleText(group.selected_class_date, group.selected_hour) : scheduleText,
  schedule_list: isTrialPackage ? singleLessonScheduleList : scheduleList
}
```

- [ ] **Step 4: Update miniprogram display pages to use the unified fields**

```xml
<view class="info-value">
  {{groupDetail.scheduleMode === 'single_session' ? groupDetail.scheduleText : groupDetail.firstClassTimeText || groupDetail.scheduleText}}
</view>
```

- [ ] **Step 5: Run focused verification**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-group-detail.test.cjs`
Expected: PASS

Run: `cd /Users/yun/lindong/backend && npm test -- packageReaders`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/lindong-api/shared/services/packageReaders.js backend/console-api-service/shared/services/packageReaders.js miniprogram/pages/group/detail/index.js miniprogram/pages/group/detail/index.wxml miniprogram/pages/payment/result/index.js miniprogram/pages/payment/result/index.wxml
git commit -m "feat: display trial package schedule details"
```

### Task 6: Final Regression Pass And Cleanup

**Files:**
- Modify only if needed after verification: touched files from Tasks 1-5
- Test: existing miniprogram and backend focused suites

- [ ] **Step 1: Run miniprogram focused tests**

Run: `cd /Users/yun/lindong/miniprogram && node tests/trial-package-home-tab.test.cjs && node tests/trial-package-start-page.test.cjs && node tests/trial-package-start-submit.test.cjs`
Expected: PASS

- [ ] **Step 2: Run existing nearby regression tests**

Run: `cd /Users/yun/lindong/miniprogram && node tests/package-start-cloudpay.test.cjs && node tests/payment-confirm-share-entry.test.cjs`
Expected: PASS

Run: `cd /Users/yun/lindong/backend && npm test -- packageOrders && npm test -- packageReaders`
Expected: PASS

- [ ] **Step 3: Run console verification**

Run: `cd /Users/yun/lindong/console && npm run lint`
Expected: PASS

- [ ] **Step 4: Check worktree status and summarize remaining risk**

Run: `cd /Users/yun/lindong && git status --short`
Expected: only intended files are modified; unrelated pre-existing changes remain untouched

- [ ] **Step 5: Commit final polish if needed**

```bash
git add <only-intended-files>
git commit -m "test: verify trial package group-buy flow"
```

---

## Self-Review

### Spec Coverage

- 首页新增 `体验课` tab: Task 2
- 体验课详情复用现有页面并调整文案: Task 2
- 开团页选择 `日期 + 开始时间`: Task 3
- 日期最早为开团后第 2 天: Task 4
- 时间范围 `09:00` 到 `19:00`: Task 3 and Task 4
- 体验课固定 `1 节课`: Task 1 and Task 4
- 后端双侧同步: Task 4 and Task 5
- 拼团详情/支付展示回填: Task 5
- 正式课不回归: Task 6

### Placeholder Scan

- No `TODO` / `TBD`
- Every task has explicit files, commands, and expected outcomes
- Code snippets use concrete property names from the approved spec: `package_category`, `classDate`, `hour`, `weekday`, `class_count`

### Type Consistency

- Frontend trial flag consistently uses `isTrialPackage`
- Trial schedule input consistently uses `classDate + hour`
- Formal-class schedule input consistently uses `weekday + hour`
- Trial package category consistently uses `体验课`

