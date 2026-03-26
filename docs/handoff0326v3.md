# 2026-03-26 工作交接文档 V3

## 1. 交接范围

项目：邻动体适能  
工作目录：`/Users/yun/lindong`  
整理时间：`2026-03-26 17:15:09 CST`

本版交接是在 `handoff0326v2.md` 基础上的继续收口，重点不再是补接口骨架，而是把管理端首页、筛选区、分页、顶部栏、概览页联调和几轮 UI 调整全部落到当前代码状态，方便接手时直接基于最新界面和真实接口继续推进。


## 2. 当前产品与数据口径

### 2.1 课程状态机

课程状态仍保持 7 个：

* `待上架`
* `拼团中`
* `拼团失败`
* `等待上课`
* `上课中`
* `已结课`
* `已下架`

关键口径不变：

* 课程成功定义为“报名截止前至少一个团成功”
* 下架是明确状态，不是删除
* 列表、详情、编辑、下架权限口径已统一

实现文件：

* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

### 2.2 拼团口径

关键规则仍为：

* 拼团是课程下子实体
* 一个课程下允许多个历史团
* 同一时刻仅允许一个 `active` 团
* 团状态固定为：
  * `active`
  * `success`
  * `failed`
* 新建团时 `expire_time = 课程报名截止时间`
* 只有支付成功后才真正入团：
  * 写入 `group_members`
  * 更新 `groups.current_count`
* 同一用户同一课程只能成功参团一次
  * 只按成功团 / 成功订单判断
  * 不按失败团成员历史判断

### 2.3 退款口径

自动退款：

* 报名截止前无成功团时，课程进入 `拼团失败`
* 进行中团变为 `failed`
* 相关订单改为 `refunded`
* 自动退款原因统一为：
  * `报名截止前未成团，系统自动退款`
* 自动退款时保留 `group_members`

手动退款：

* 只有已支付订单允许手动退款
* 手动退款后回滚：
  * 该用户的 `group_members`
  * `groups.current_count`
  * `groups.status`
* 团状态回滚规则：
  * 人数仍达标：保留 `success`
  * 人数不足且未过期：回滚为 `active`
  * 人数不足且已过期：回滚为 `failed`


## 3. 本轮新增完成内容

### 3.1 后端

主要涉及文件：

* [index.js](/Users/yun/lindong/backend/routes/admin/index.js)
* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [accounts.js](/Users/yun/lindong/backend/routes/admin/accounts.js)
* [adminStore.js](/Users/yun/lindong/backend/utils/adminStore.js)

本轮后端已完成：

* 已将 `dashboard` 路由正式挂载到后台管理端路由入口
* 概览接口支持时间范围切换：
  * `today`
  * `7d`
  * `30d`
* 概览接口支持返回环比字段：
  * `current`
  * `previous`
  * `delta`
  * `direction`
* 概览接口支持返回异常提示指标：
  * 失败团仍有未退款订单数
  * 过期仍进行中的团数
  * 团人数与成员记录不一致数
  * 自动退款订单数
* 拼团列表接口支持按 `success_time` 过滤，解决概览“成功成团”卡片下钻口径不一致问题
* 订单列表接口修正了筛选后 `total` 不准确的问题
* 课程列表、订单列表、账号列表都补齐了分页返回：
  * `total`
  * `page`
  * `size`
  * `total_pages`
* 账号列表接口支持按：
  * 用户名
  * 角色
  * 状态
 进行查询

### 3.2 前端

主要涉及文件：

* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [AccountListPage.tsx](/Users/yun/lindong/console/src/pages/AccountListPage.tsx)
* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)
* [PaginationBar.tsx](/Users/yun/lindong/console/src/components/PaginationBar.tsx)
* [styles.css](/Users/yun/lindong/console/src/styles.css)

本轮前端已完成：

* 顶部栏已移除旧占位文案：
  * `运营工作台`
  * `管理端开发骨架`
* 顶部栏左侧改为显示当前模块名称
* 右上角保留当前登录用户展示
* 各模块首页不再在内容区重复展示模块名称
* 概览页已重构为两段式结构：
  * `数据概括`
  * `异常提示`
* 概览页支持时间切换：
  * 今日
  * 近 7 天
  * 近 30 天
* 概览页各数据卡片支持直接下钻到对应列表页
* 概览页金额展示已做格式化
* 概览页异常卡片支持直接下钻
* 课程详情页、编辑页、拼团详情页、课程下拼团记录页已支持返回上一级
* 拼团详情成员模块已统一展示“入团时间”，并保留说明文案
* 课程列表 / 拼团列表 / 订单列表 / 账号列表 / 日志列表的筛选模块已统一重做为面板样式
* 各筛选模块的“查询”按钮已统一：
  * 使用蓝色底
  * 白色文字
* 课程管理页筛选区特殊布局：
  * 无“课程筛选”标题
  * `查询` 在下一行靠左
  * `新建课程` 在同一行靠右
  * 两个按钮已统一宽高
* 拼团管理页筛选区特殊布局：
  * 无“拼团筛选”标题
  * `查询` 在下一行靠左
* 订单管理页筛选区特殊布局：
  * 无“订单筛选”标题
  * `查询` 在下一行靠右
  * 筛选项固定为一行 4 列展示
* 账号管理页筛选区特殊布局：
  * 无“账号筛选”标题
  * 支持按用户名、角色、状态筛选
  * `查询` 与 `新增账号` 放在筛选项下一行，且 `新增账号` 在 `查询` 右侧
* 操作日志页筛选区已与其他管理页风格对齐：
  * 无“日志筛选”标题
  * `查询` 在下一行靠右
* 四个主要列表页已统一接入新的分页条组件：
  * 课程管理
  * 拼团管理
  * 订单管理
  * 账号管理


## 4. 概览页当前设计与联调结论

### 4.1 当前概览页结构

当前概览页已明确分为两部分：

1. 数据概括
2. 异常提示

数据概括当前展示：

* 当前拼团中的课程
* 当前范围内要上课的课程
* 当前范围内上架课程
* 当前范围内成功成团
* 当前范围内参团人数
* 当前范围内成团金额

异常提示当前展示：

* 失败团仍有未退款订单
* 团已过期但仍显示进行中
* 团人数与成员记录不一致
* 当前范围内系统自动退款订单数

### 4.2 已实际联调确认的结果

本轮已使用本地启动的管理端服务做过真实接口联调，确认：

* `GET /api/admin/dashboard/overview?range=today` 可正常返回
* `自动退款订单数` 概览值与订单下钻结果已对齐
* `成功成团数` 概览值与按 `success_time` 下钻后的拼团列表结果已对齐
* 课程 `status=1` 下钻结果与“当前拼团中的课程”概览值一致

本轮修掉的联调问题：

1. 订单列表筛选后 `list` 正确但 `total` 仍是原始总数  
现已修复，返回值改为筛选后总数。

2. “成功成团”概览卡片按成团时间统计，但拼团列表不支持相同口径下钻  
现已修复，拼团列表接口支持 `date_field=success_time`。


## 5. 当前分页状态

### 5.1 已补齐分页的页面

当前四个列表页都已支持分页展示与切页：

* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [AccountListPage.tsx](/Users/yun/lindong/console/src/pages/AccountListPage.tsx)

分页统一样式由：

* [PaginationBar.tsx](/Users/yun/lindong/console/src/components/PaginationBar.tsx)

提供。

### 5.2 当前未补分页的页面

以下页面仍不涉及标准列表分页，当前可维持现状：

* 课程详情页
* 拼团详情页
* 订单详情区块
* 操作日志页当前仍是固定拉取前 50 条，不是正式分页视图


## 6. 已完成验证

### 6.1 构建验证

本轮已反复执行：

* `cd /Users/yun/lindong/console && npm run build`

当前前端构建通过。

### 6.2 后端加载验证

本轮已验证以下模块可正常加载：

* 管理端总路由入口
* 课程管理路由
* 拼团管理路由
* 订单管理路由
* 账号管理路由
* 管理员查询工具模块

### 6.3 接口联调验证

已完成的真实联调重点：

* 本地 `/health` 可访问
* 本地控制台页面可访问
* 管理端登录可成功获取 token
* 概览接口可正常返回
* 自动退款异常下钻结果正确
* 成功成团下钻口径正确


## 7. 当前仍需注意的问题

### 7.1 课程表单和后端报错文案仍未完全统一

后端 [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js) 中部分报错仍是旧口径：

* `成团人数必须大于 0`
* `最大成团次数必须大于 0`
* `结束时间不能为空`

如果要和当前前端彻底统一，后续建议改为：

* `成团人数要求必须大于 0`
* `最大成团数量必须大于 0`
* `下课时间不能为空`

### 7.2 操作日志页仍未做正式分页

当前日志页仍是固定请求：

* `page=1`
* `size=50`

如果后续日志量增长，需要单独补正式分页条与更多筛选能力。

### 7.3 账号管理页按钮样式与其他页略有定制

账号管理页因为“查询”和“新增账号”被放进同一操作行，所以布局比其他页更特殊。后续如果要继续统一样式，需要先决定：

* 是以账号管理页为基准统一
* 还是继续保留它的特殊布局


## 8. 接手建议顺序

建议后续继续按这个顺序推进：

1. 补课程表单与后端校验文案统一  
优先统一“成团人数要求 / 最大成团数量 / 下课时间”。

2. 再做一轮完整 UI 回归  
重点检查：
* 各筛选模块布局
* 查询按钮颜色
* 分页条展示
* 顶部栏模块名与页面内容层级

3. 操作日志页视需要补正式分页  
如果日志开始持续累积，建议优先做。

4. 固化测试数据重置方案  
把 Supabase 清库 / 导数 / 校验步骤落成固定文档或脚本。


## 9. 关键文件清单

后端：

* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)
* [index.js](/Users/yun/lindong/backend/routes/admin/index.js)
* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [accounts.js](/Users/yun/lindong/backend/routes/admin/accounts.js)
* [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)
* [adminStore.js](/Users/yun/lindong/backend/utils/adminStore.js)

前端：

* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [PaginationBar.tsx](/Users/yun/lindong/console/src/components/PaginationBar.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [CourseFormPage.tsx](/Users/yun/lindong/console/src/pages/CourseFormPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [GroupDetailPage.tsx](/Users/yun/lindong/console/src/pages/GroupDetailPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [AccountListPage.tsx](/Users/yun/lindong/console/src/pages/AccountListPage.tsx)
* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)
* [styles.css](/Users/yun/lindong/console/src/styles.css)

文档：

* [handoff0326.md](/Users/yun/lindong/docs/handoff0326.md)
* [handoff0326v2.md](/Users/yun/lindong/docs/handoff0326v2.md)
* [handoff0326v3.md](/Users/yun/lindong/docs/handoff0326v3.md)
