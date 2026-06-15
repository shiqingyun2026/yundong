# 2026-06-15 课包开团排课改造交接文档

## 1. 背景

本轮改造目标是调整小程序“课包开团”页的上课时间选择逻辑，不再按“体验课 / 非体验课”区分，而是统一按 **课包总课时数** 判断排课模型。

当前已涉及：

- 小程序开团页：`miniprogram/pages/package/start/`
- 相关排课工具：`miniprogram/utils/packageSchedule.js`
- 小程序课包详情归一化：`miniprogram/utils/package.js`
- 小程序对应静态 / 单元测试：`miniprogram/tests/`
- 小程序下单接口与共享排课服务：
  - `backend/lindong-api/routes/package-orders.js`
  - `backend/lindong-api/shared/services/packageOrders.js`
  - `backend/lindong-api/shared/services/packageSchedule.js`
  - `backend/console-api-service/shared/services/packageOrders.js`
  - `backend/console-api-service/shared/services/packageSchedule.js`
- 对应后端测试：`backend/tests/`

仍不在本轮范围：

- 参团页
- 课表编辑页
- 运营后台配置页

## 2. 已确认产品口径

### 2.1 排课模型

统一按 `课包总课时 class_count` 处理：

- `class_count = 1`
  - 走“具体日期 + 时间”的单次课模型
  - 不再判断是不是体验课
- `class_count >= 2`
  - 进入频率化排课模型

### 2.2 频率选项

当前已按最新口径收敛为：

- `class_count = 2`
  - 可选：`每天1次` / `每周1次` / `每周2次`
  - 不可选：`每周3次`
- `class_count >= 3`
  - 可选：`每天1次` / `每周1次` / `每周2次` / `每周3次`

说明：

- 这样可以减少类型分叉，前端和排课生成逻辑更统一。

### 2.3 日期与时间规则

- `每天1次`
  - 选择“开始日期 + 上课时间”
  - 开始日期最早为 `T+2`
- `每周1次 / 每周2次 / 每周3次`
  - 选择“上课日期（周几）+ 上课时间”
  - 系统从 `T+2` 开始，自动生成完整课表
- 时间选择支持半小时粒度：
  - `09:00`
  - `09:30`
  - `10:00`
  - `10:30`
  - ...
  - 最早 `09:00`
  - 最晚 `19:00`

### 2.4 周期选择规则

- 每周 1 次：必须选 `1` 个星期
- 每周 2 次：必须选 `2` 个不同星期
- 每周 3 次：必须选 `3` 个不同星期
- 不允许重复选同一天

## 3. 本轮新增 UI 口径

用户最新补充的页面交互要求：

1. 删除“课程频率”四个字，仅保留四个频率按钮。
2. 缩小频率按钮宽度，使四个选项可一排展示。
3. 当选择 `每周1次 / 每周2次 / 每周3次` 时：
   - 表单区显示一行“上课日期”
   - 点击后拉起底部弹层
   - 弹层内可选 `周一 ~ 周日`
   - 选择数量必须与频率严格一致
4. “课程预览”支持单节改期：
   - 仅 `class_count > 1` 时展示“课时预览”
   - 点击某一节，仅修改当前这一节
   - 弹层内直接完成“上课日期 + 开始时间”选择，不再二次拉起系统选择器
   - 上课日期提供未来 `45` 天整日期滑动项
   - 开始时间保持半小时粒度
   - 结束时间 = `开始时间 + 课时长`
   - 底部确认按钮使用主题色 `#1abcc5`
5. 主表单“上课时间”展示改为区间文案：
   - 例如 `09:00—10:30`
   - 结束时间同样由课包课时长推导

## 4. 当前代码完成情况

### 4.1 已完成

以下能力已落地：

- 按 `class_count` 决定排课模型
- `class_count = 1` 使用单次课“日期 + 时间”模型
- `class_count >= 2` 使用频率化排课模型
- 支持频率选项按课时数动态收敛
- 时间选项改为 `09:00 ~ 19:00` 的半小时粒度
- 主表单时间文案改为 `开始时间—结束时间`
- `每天1次` 保留 `T+2` 开始日期限制
- 周频课自动生成完整课时预览
- 校验“周频选择数量必须严格等于频率次数”
- 删除“课程频率”文案
- 频率按钮样式缩小为单行展示
- 周频的“上课日期”改为点击行唤起底部弹层
- 周频弹层支持 `周一 ~ 周日` 多选并确认
- 周频弹层文案改为 `需选择x天`
- 周频弹层按 `4 + 3` 布局展示星期项
- 仅 `class_count > 1` 时展示“课时预览”
- “课时预览”支持单节编辑
- 单节编辑弹层内直接使用 `picker-view` 完成日期 / 时间滑动选择
- 单节编辑日期列使用未来 `45` 天完整日期
- 单节编辑开始时间列显示区间文案，结束时间列自动联动
- 下单时提交 `scheduleList`
- 后端已接受并优先使用前端传入的 `scheduleList`

### 4.2 当前主要修改文件

- `miniprogram/pages/package/start/index.js`
- `miniprogram/pages/package/start/index.wxml`
- `miniprogram/pages/package/start/index.wxss`

已新增 / 调整的核心状态和方法包括：

- `scheduleTypeOptions`
- `selectedScheduleTypeValue`
- `selectedScheduleDate`
- `selectedScheduleDays`
- `pendingScheduleDays`
- `scheduleDaysDisplayText`
- `showScheduleDaysPopup`
- `selectedScheduleTime`
- `selectedScheduleTimeLabel`
- `schedulePreviewList`
- `editableScheduleList`
- `openScheduleDaysPopup`
- `closeScheduleDaysPopup`
- `confirmScheduleDaysPopup`
- `openScheduleItemEditor`
- `syncScheduleItemEditorState`
- `handleScheduleItemPickerChange`
- `confirmScheduleItemEditor`
- `validateScheduleSelection`
- `buildSchedulePayload`

## 5. 当前未完成项

### 5.1 前端 UI 仍需真机 / 开发者工具手验

当前自动化已覆盖结构与提交字段，但以下交互还没有补到真实 UI 验证：

- 单节编辑弹层中 `picker-view` 的实际可滑动效果
- 日期列 / 时间列在不同机型上的可点击区域与滚动体验
- 单节改期后，页面预览列表与最终支付链路的联动表现

### 5.2 尚未形成本轮最终提交

当前这批“频率化排课 + 周几弹层 + 单节编辑 + scheduleList 下发”改动还未形成新的 commit。

## 6. 当前验证状态

### 6.1 已通过

已执行通过：

```bash
node --check miniprogram/pages/package/start/index.js
node --test miniprogram/tests/package-start-frequency-page.test.cjs
node --test miniprogram/tests/package-start-frequency-page.test.cjs miniprogram/tests/trial-package-start-page.test.cjs miniprogram/tests/trial-package-start-submit.test.cjs
node --test backend/tests/miniprogram-routes.mysql.test.js
node --test backend/tests/package-orders.test.js --test-name-pattern "package start payment creates group|trial package start rejects|package start order stores custom schedule list"
```

### 6.2 当前未回归 / 已知保留项

- 未执行微信开发者工具里的真实编译 / 交互回归
- `backend/tests/package-orders.test.js` 中两条与本需求无关的 join-order 旧用例仍有既有失败，原因为 `requireMySqlEnv is not a function`

## 7. 工作区状态提醒

执行本轮交接文档前，`git status --short` 为：

```txt
 M backend/console-api-service/shared/services/packageOrders.js
 M backend/console-api-service/shared/services/packageSchedule.js
 M backend/lindong-api/routes/package-orders.js
 M backend/lindong-api/shared/services/packageOrders.js
 M backend/lindong-api/shared/services/packageSchedule.js
 M backend/tests/miniprogram-routes.mysql.test.js
 M backend/tests/package-orders.test.js
M  miniprogram/config/env.js
 M miniprogram/pages/package/start/index.js
 M miniprogram/pages/package/start/index.wxml
 M miniprogram/pages/package/start/index.wxss
 M miniprogram/tests/package-start-frequency-page.test.cjs
 M miniprogram/tests/trial-package-start-submit.test.cjs
 M miniprogram/utils/package.js
?? docs/miniprogram/2026-06-15-package-start-schedule-handoff.md
```

注意：

- `miniprogram/config/env.js` 是**用户已有改动**，与本次需求无关
- 后续提交时不要把它一起提交
- 本轮后端改动已经是配套的一部分，提交时要和前端一起看成同一批次

## 8. 建议接手步骤

建议下一位继续按以下顺序推进：

1. 更新 `miniprogram/tests/package-start-frequency-page.test.cjs`
2. 在微信开发者工具验证以下交互：
   - 周频“上课日期”弹层
   - 单节编辑弹层的日期 / 时间滑动
   - 修改单节后预览列表是否即时刷新
3. 重新执行：

```bash
node --check miniprogram/pages/package/start/index.js
node --test miniprogram/tests/package-start-frequency-page.test.cjs miniprogram/tests/trial-package-start-page.test.cjs miniprogram/tests/trial-package-start-submit.test.cjs
```

4. 如需一起验后端，补跑：

```bash
node --test backend/tests/miniprogram-routes.mysql.test.js
node --test backend/tests/package-orders.test.js --test-name-pattern "package start payment creates group|trial package start rejects|package start order stores custom schedule list"
```

5. 确认页面无新增回归后，仅暂存本需求相关文件
6. 不要暂存 `miniprogram/config/env.js`
7. 形成新 commit，再按需要推送 GitHub

## 9. 备注

此前已经存在一个相关提交：

- `034cd6e`
  - `support flexible package scheduling for package groups`

这次未提交的改动是在该基础上继续做的 UI、交互和后端提交结构收口，不是从零开始。
