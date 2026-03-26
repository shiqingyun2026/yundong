# 2026-03-26 工作交接文档 V4

## 1. 交接范围

项目：邻动体适能  
工作目录：`/Users/yun/lindong`  
整理时间：`2026-03-26 23:59:00 CST`

本版交接是在 `handoff0326v3.md` 基础上的继续收口，重点是把本轮补上的分页、权限、交互校验、PRD 同步，以及用户侧课程与拼团展示口径一起沉淀下来，方便后续继续推进时直接对照最新实现。


## 2. 当前核心口径

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
* 后台状态由后端自动计算，前端只展示

### 2.2 用户端课程展示口径

本轮已明确调整为：

* 小程序首页 / 课程列表不再展示以下课程状态：
  * `待上架`
  * `拼团失败`
  * `已下架`
  * `已结课`
* 当前用户端课程接口仅保留：
  * `拼团中`
  * `等待上课`
  * `上课中`

实现文件：

* [courses.js](/Users/yun/lindong/backend/routes/courses.js)

### 2.3 用户端拼团记录展示口径

本轮已明确调整为：

* “我的拼团记录”的筛选维度仍按拼团状态归类：
  * `进行中`
  * `已成团`
  * `已失败`
* 当团状态为 `success` 时：
  * 若课程未结课，列表与详情额外展示 `等待上课`
  * 若课程已结课，列表与详情额外展示 `已结课`
* 也就是说：
  * 已结课的成功团，仍归在“已成团”tab 下
  * 但会额外展示课程阶段标识 `已结课`

实现文件：

* [user.js](/Users/yun/lindong/backend/routes/user.js)
* [groups.js](/Users/yun/lindong/backend/routes/groups.js)
* [course.js](/Users/yun/lindong/utils/course.js)
* [pages/my/group-buy-list/index.wxml](/Users/yun/lindong/pages/my/group-buy-list/index.wxml)
* [pages/group/detail/index.js](/Users/yun/lindong/pages/group/detail/index.js)


## 3. 本轮新增完成内容

### 3.1 后端

主要涉及文件：

* [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)
* [courses.js](/Users/yun/lindong/backend/routes/courses.js)
* [user.js](/Users/yun/lindong/backend/routes/user.js)
* [groups.js](/Users/yun/lindong/backend/routes/groups.js)

本轮后端已完成：

* 操作日志接口补齐正式分页返回：
  * `total`
  * `page`
  * `size`
  * `total_pages`
* 用户端课程接口改为统一过滤不应展示给小程序的课程状态
* 用户端拼团记录接口在成功团场景下增加课程阶段展示字段：
  * `等待上课`
  * `已结课`
* 用户端拼团详情接口在成功团场景下增加课程阶段展示字段

### 3.2 管理端前端

主要涉及文件：

* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)
* [AccountListPage.tsx](/Users/yun/lindong/console/src/pages/AccountListPage.tsx)
* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [App.tsx](/Users/yun/lindong/console/src/App.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [styles.css](/Users/yun/lindong/console/src/styles.css)

本轮管理端前端已完成：

* 操作日志页已补正式分页条
* 操作日志页已改为 URL 参数驱动筛选与翻页，翻页时保留筛选条件
* 账号管理弹窗已补：
  * 确认密码
  * 密码一致性校验
  * 至少 6 位前端校验
  * 密码明文 / 隐藏切换
* 超级管理员以外的角色：
  * 左侧导航不再展示“账号管理”
  * 直接访问 `/accounts` 会被前端重定向回 `/dashboard`
* 概览页趋势文案已微调：
  * `与上一周期持平` → `持平`
* 课程列表里的“下架”按钮样式已调整为：
  * 与“查看拼团”同层级文本样式
  * 红色字体强调

### 3.3 文档

主要涉及文件：

* [console_prd.md](/Users/yun/lindong/docs/console/console_prd.md)

本轮文档已完成：

* PRD 已同步“登录成功进入概览页”
* PRD 已正式写回概览页：
  * `今日 / 近 7 天 / 近 30 天`
  * 下钻规则
  * 默认筛选透传与回显
* PRD 已同步拼团列表支持 `入团时间`
* PRD 已同步操作日志正式分页
* PRD 已同步账号管理补充：
  * 确认密码
  * 密码明文展示开关
  * 普通管理员前端不展示账号管理入口


## 4. 本轮联调与验证结论

### 4.1 管理端

已完成验证：

* `console` 多次执行构建成功：
  * `cd /Users/yun/lindong/console && npm run build`
* 后端以下文件已通过 `node --check`：
  * [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
  * [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
  * [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)

### 4.2 用户端

已完成逻辑验证结论：

* 小程序课程列表不再返回：
  * `待上架`
  * `拼团失败`
  * `已下架`
  * `已结课`
* 用户拼团记录中，成功团仍归类在“已成团”筛选页
* 成功团的课程阶段会额外显示：
  * `等待上课`
  * `已结课`


## 5. 当前仍需注意的问题

### 5.1 管理端课程表单字段文案仍有统一空间

后端 [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js) 中部分报错文案仍和当前前端表单口径不完全一致，后续如果还要继续抠细节，建议统一：

* `成团人数必须大于 0` → `成团人数要求必须大于 0`
* `最大成团次数必须大于 0` → `最大成团数量必须大于 0`
* `结束时间不能为空` → `下课时间不能为空`

### 5.2 用户端“已成团”tab 当前仍不拆“已结课”独立分类

当前已按产品要求实现为：

* 仍归类在“已成团”下
* 通过附加标签展示 `等待上课 / 已结课`

如果后续产品希望把 `已结课` 单独拆成独立 tab，需要再改：

* `backend/routes/user.js`
* `pages/my/group-buy-list/index.js`
* `utils/course.js`

### 5.3 测试数据当前仍需依赖手工 SQL 导入

本轮已整理过一版可用于验证：

* 成功团 + 等待上课
* 成功团 + 已结课

后续建议把这套 SQL 固化到：

* 独立 SQL 文件
* 或脚本化 seed / reset 流程


## 6. 接手建议顺序

建议后续优先按这个顺序推进：

1. 固化用户侧测试数据脚本  
把“等待上课 / 已结课 / 拼团失败 / 拼团中”几类课程与团统一沉淀成可重复执行的 SQL 或 seed。

2. 再做一轮用户端回归  
重点检查：
* 首页课程列表过滤
* 课程详情是否还能正常访问可展示课程
* 我的拼团记录标签展示
* 拼团详情状态与底部文案

3. 继续统一课程表单与后端报错文案  
避免 PRD、前端文案、后端返回三套口径。

4. 若日志开始持续增长，再评估是否补更多日志筛选维度  
当前分页已经补齐，后续可按需要扩展动作枚举、对象类型和时间筛选。


## 7. 关键文件清单

管理端后端：

* [dashboard.js](/Users/yun/lindong/backend/routes/admin/dashboard.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [accounts.js](/Users/yun/lindong/backend/routes/admin/accounts.js)
* [logs.js](/Users/yun/lindong/backend/routes/admin/logs.js)

管理端前端：

* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [PaginationBar.tsx](/Users/yun/lindong/console/src/components/PaginationBar.tsx)
* [DashboardPage.tsx](/Users/yun/lindong/console/src/pages/DashboardPage.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [AccountListPage.tsx](/Users/yun/lindong/console/src/pages/AccountListPage.tsx)
* [AdminLogPage.tsx](/Users/yun/lindong/console/src/pages/AdminLogPage.tsx)
* [styles.css](/Users/yun/lindong/console/src/styles.css)

用户端：

* [courses.js](/Users/yun/lindong/backend/routes/courses.js)
* [user.js](/Users/yun/lindong/backend/routes/user.js)
* [groups.js](/Users/yun/lindong/backend/routes/groups.js)
* [course.js](/Users/yun/lindong/utils/course.js)
* [pages/my/group-buy-list/index.js](/Users/yun/lindong/pages/my/group-buy-list/index.js)
* [pages/my/group-buy-list/index.wxml](/Users/yun/lindong/pages/my/group-buy-list/index.wxml)
* [pages/group/detail/index.js](/Users/yun/lindong/pages/group/detail/index.js)
* [pages/group/detail/index.wxml](/Users/yun/lindong/pages/group/detail/index.wxml)

文档：

* [handoff0326v3.md](/Users/yun/lindong/docs/handoff0326v3.md)
* [handoff0326v4.md](/Users/yun/lindong/docs/handoff0326v4.md)
* [console_prd.md](/Users/yun/lindong/docs/console/console_prd.md)
