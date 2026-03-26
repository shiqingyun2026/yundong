# 2026-03-26 工作交接文档 V2

## 1. 交接范围

项目：邻动体适能  
工作目录：`/Users/yun/lindong`

本轮交接覆盖的是运营后台 2026-03-26 这一天的第二阶段收口，重点不是“从零搭骨架”，而是把课程、拼团、订单、退款、日志和数据概览这些运营主链路逐步串起来，并开始补联调与回归所需的基础能力。


## 2. 当前产品口径

### 2.1 课程状态机

课程状态当前口径已经统一为 7 个：

* `待上架`
* `拼团中`
* `拼团失败`
* `等待上课`
* `上课中`
* `已结课`
* `已下架`

后端常量定义见：

* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

状态规则：

* 上架时间前：`待上架`
* 上架后且尚无成功团：`拼团中`
* 报名截止前只要至少一个团成功：`等待上课`
* 开课时间到下课时间之间：`上课中`
* 到下课时间：`已结课`
* 到报名截止时间仍无成功团：`拼团失败`
* 到下架时间后：`已下架`

关键口径：

* 课程成功定义为“报名截止前至少一个团成功”
* 下架不是删除，而是一个明确状态
* 当前课程列表和课程详情页的操作权限口径已统一

### 2.2 拼团规则

* 拼团是课程下的子实体
* 一个课程下可以有多个历史团
* 同一时刻仅允许一个 `active` 团
* 团状态固定为：
  * `active`
  * `success`
  * `failed`
* 新建团时，`expire_time` 统一等于课程报名截止时间
* 只有支付成功后，用户才真正入团：
  * 写入 `group_members`
  * 更新 `groups.current_count`
* 同一用户同一课程只能成功参团一次
  * 只按成功团 / 成功订单判断
  * 不按失败团成员关系判断

### 2.3 自动退款与手动退款

自动退款规则：

* 报名截止前无成功团时，课程状态进入 `拼团失败`
* 课程下仍进行中的团会改成 `failed`
* 相关订单改成 `refunded`
* 自动退款原因统一为：
  * `报名截止前未成团，系统自动退款`
* 自动退款时保留 `group_members` 记录

手动退款规则：

* 只有已支付订单才允许手动退款
* 手动退款会更新订单退款字段
* 手动退款后会自动回滚：
  * 该用户的 `group_members`
  * `groups.current_count`
  * `groups.status`
* 团状态回滚规则：
  * 人数仍达标：保留 `success`
  * 人数不足且未过期：回滚为 `active`
  * 人数不足且已过期：回滚为 `failed`
* 手动退款后会再次触发课程状态同步


## 3. 本轮已完成内容

### 3.1 后端

主要文件：

* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)
* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
* [index.js](/Users/yun/lindong/backend/routes/admin/index.js)

已完成能力：

* 课程状态统一由后端计算与同步
* 课程状态已补 `已下架`
* 课程列表 / 课程详情 / 下架接口的权限口径已统一
* 拼团管理支持筛选、详情、订单联动、异常提示
* 订单支持手动退款
* 手动退款支持回滚拼团人数、成员记录与团状态
* `admin_log` 已接入：
  * 课程创建
  * 课程编辑
  * 课程下架
  * 课程状态同步
  * 课程自动退款
  * 订单手动退款
* 已新增操作日志查询接口
* 已新增数据概览接口文件

当前后台管理端路由包括：

* `GET /api/admin/courses`
* `GET /api/admin/courses/:id`
* `PUT /api/admin/courses/:id`
* `PUT /api/admin/courses/:id/offline`
* `GET /api/admin/courses/:id/groups`
* `GET /api/admin/groups`
* `GET /api/admin/groups/:id`
* `GET /api/admin/groups/:id/orders`
* `GET /api/admin/orders`
* `GET /api/admin/orders/:id`
* `POST /api/admin/orders/:id/refund`
* `GET /api/admin/logs`

### 3.2 前端

主要文件：

* [App.tsx](/Users/yun/lindong/console/src/App.tsx)
* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [CourseFormPage.tsx](/Users/yun/lindong/console/src/pages/CourseFormPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [GroupDetailPage.tsx](/Users/yun/lindong/console/src/pages/GroupDetailPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [PageBackButton.tsx](/Users/yun/lindong/console/src/components/PageBackButton.tsx)
* [SearchIcon.tsx](/Users/yun/lindong/console/src/components/SearchIcon.tsx)

已完成页面能力：

* 课程列表页已精简字段
* 课程列表页新增：
  * `查看`
  * `查看拼团`
  * 图标样式搜索按钮
  * 所在区域
  * 详细地点
* 课程列表页已将“成团人数”文案改为“成团人数要求”
* 课程新建页已改为深圳口径的省市区三级选择：
  * 省固定：广东省
  * 市固定：深圳市
  * 区支持常用城区选择
* 课程详情页 / 编辑页 / 拼团详情页已补返回上一级按钮
* 课程详情页支持查看拼团记录区块
* 课程详情页支持只读查看模式
* 课程详情页必填项已补 `*` 标识
* 拼团详情页成员模块已将“加入时间”文案改为“入团时间”
* 拼团详情页已补解释文案：
  * 入团时间表示该成员支付成功后被写入拼团成员记录的时间
* 订单详情退款区已补明确提示：
  * 手动退款会回滚拼团人数和团状态
* 操作日志页面已提供后台查看入口
* 概览页前端已切换为真实数据概览卡片展示

### 3.3 当前概览页指标设计

前端概览页当前期望展示的字段为：

* 今日拼团中的课程数
* 今日要上课的课程数
* 今日上架课程数
* 今日成功成团数
* 累计拼团人数
* 累计成团金额

实现文件：

* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)


## 4. 已完成验证

### 4.1 验证脚本

脚本与命令：

* [verify-course-lifecycle.js](/Users/yun/lindong/backend/scripts/verify-course-lifecycle.js)
  * `npm run verify:course-lifecycle`
* [verify-group-rules.js](/Users/yun/lindong/backend/scripts/verify-group-rules.js)
  * `npm run verify:group-rules`
* [verify-admin-seed.js](/Users/yun/lindong/backend/scripts/verify-admin-seed.js)
  * `npm run verify:admin-seed`

`package.json` 已挂载的脚本见：

* [package.json](/Users/yun/lindong/backend/package.json)

### 4.2 已确认通过的场景

* 课程状态机主要流转
* 课程失败自动退款
* 失败团不阻塞未来再次参团
* 成功团 / 成功订单仍会拦截重复成功参团
* 手动退款后回滚团人数、团状态、成员记录

### 4.3 当前需要注意的验证结果

`verify:admin-seed` 当前不是稳定全绿基线，原因不是脚本报错，而是它依赖一套固定测试数据状态。若人工对测试课程做过下架等操作，校验会失败。

当前已知例子：

* `[测试] 深圳南山周末体适能·待上架` 被手动下架后，会导致脚本中原本期望的 `待上架` 状态与实际 `已下架` 不一致


## 5. 当前数据库与测试数据说明

### 5.1 Migration

需要确认这份 migration 已执行：

* [20260326_course_lifecycle.sql](/Users/yun/lindong/backend/migrations/20260326_course_lifecycle.sql)

如果未执行，课程生命周期相关字段会缺失。

### 5.2 清库与测试数据

本轮已经整理过“清空业务数据并重新导入测试课程 / 拼团 / 订单”的 SQL 方案，但执行需要人工到 Supabase 后台完成，当前仓库里还没有把这套 SQL 产物化成固定文件。

保留口径：

* 保留：`admin_users`、`users`
* 清空：`courses`、`groups`、`group_members`、`orders`、`admin_log`


## 6. 当前已知问题与未完成项

### 6.1 明确阻塞项

数据概览接口文件已经新增，但后端路由尚未挂载到 `admin/index.js`。

当前现状：

* 前端 [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx) 已请求 `/dashboard/overview`
* 后端 [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js) 已存在
* 但 [index.js](/Users/yun/lindong/backend/routes/admin/index.js) 目前还没有 `router.use('/dashboard', ...)`

结果：

* 概览页现在会因为接口未接入而不可用

### 6.2 今日最后一轮 UI 需求仍待收口

用户今天最后一轮提出了 5 点，其中部分已完成，部分仍建议接手后再次整体回归：

1. 课程管理搜索按钮改为图标样式  
当前前端代码已改，需实际回归列表页交互。

2. 页面之间补返回上一级按钮  
当前课程详情页、编辑页、拼团详情页已补，其他页面是否需要统一补齐可继续评估。

3. 概览模块改为真实数据概览  
前端和后端文件已写，但接口未挂载，当前还不算真正完成。

4. “成团人数”改为“成团人数要求”  
课程列表页、拼团详情页前端文案已改，建议顺手检查课程表单校验文案是否也要统一改名。

5. 拼团详情成员模块“加入时间”的含义  
已在页面文案解释为：支付成功后写入 `group_members` 的时间。

### 6.3 文案与校验仍可继续统一

后端 [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js) 中部分校验文案仍使用旧表述：

* `成团人数必须大于 0`
* `最大成团次数必须大于 0`
* `结束时间不能为空`

如果产品最终口径统一为：

* `成团人数要求`
* `最大成团数量`
* `下课时间`

建议后续把表单标题、后端报错文案、日志详情文案一起统一。


## 7. 接手建议顺序

建议按下面顺序继续：

1. 接入数据概览路由  
在 [index.js](/Users/yun/lindong/backend/routes/admin/index.js) 挂上 `dashboard` 路由，并联调概览页。

2. 跑一轮前后端回归  
重点回归：
* 课程列表搜索与下架
* 课程详情查看 / 编辑 / 下架
* 拼团详情成员与订单展示
* 订单手动退款后回滚
* 操作日志是否落库

3. 固化测试数据重置方案  
把 Supabase 手动执行步骤、清库 SQL、导数 SQL、校验命令整理成固定文档或脚本文件。

4. 继续补文案统一  
尤其是“下课时间 / 成团人数要求 / 最大成团数量”这类已改一半的口径。

5. 视需要增强日志页  
例如补时间范围筛选、动作中文映射优化、课程名 / 订单号展示增强。


## 8. 关键文件清单

后端：

* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)
* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
* [index.js](/Users/yun/lindong/backend/routes/admin/index.js)
* [verify-course-lifecycle.js](/Users/yun/lindong/backend/scripts/verify-course-lifecycle.js)
* [verify-group-rules.js](/Users/yun/lindong/backend/scripts/verify-group-rules.js)
* [verify-admin-seed.js](/Users/yun/lindong/backend/scripts/verify-admin-seed.js)

前端：

* [App.tsx](/Users/yun/lindong/console/src/App.tsx)
* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [PageBackButton.tsx](/Users/yun/lindong/console/src/components/PageBackButton.tsx)
* [SearchIcon.tsx](/Users/yun/lindong/console/src/components/SearchIcon.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [CourseFormPage.tsx](/Users/yun/lindong/console/src/pages/CourseFormPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [GroupDetailPage.tsx](/Users/yun/lindong/console/src/pages/GroupDetailPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)

文档：

* [handoff0326.md](/Users/yun/lindong/docs/handoff0326.md)
* [handoff0326v2.md](/Users/yun/lindong/docs/handoff0326v2.md)
* [console_prd.md](/Users/yun/lindong/docs/console/console_prd.md)
