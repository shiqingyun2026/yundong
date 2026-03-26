# 2026-03-26 工作交接文档

## 1. 本轮工作概况

项目：邻动体适能  
工作目录：`/Users/yun/lindong`

本轮主要完成的是运营后台方向的收口与扩展，核心包括：

* 运营后台课程状态机落地
* 课程上下架时间与报名截止规则接入
* 自动退款展示链路接入订单管理
* 拼团规则统一
* 拼团管理模块骨架搭建
* PRD 与专项规划文档同步

已推送到 GitHub 的最新提交：

* `a5eeafc`
  `完善运营后台课程状态与拼团管理骨架`


## 2. 当前已确认的产品口径

以下规则本轮已经确认，并已同步到代码和文档：

### 2.1 课程状态机

课程状态固定为：

* 待上架
* 已下架
* 拼团中
* 拼团失败
* 等待上课
* 上课中
* 已结课

状态流转规则：

* 上架时间前：`待上架`
* 到下架时间后：`已下架`
* 到上架时间后，且课程尚无成功团：`拼团中`
* 报名截止前只要有至少一个成功团：`等待上课`
* 开课时间到结束时间之间：`上课中`
* 到结束时间：`已结课`
* 到报名截止时间仍没有一个成功团：`拼团失败`

关键口径：

* **课程成功定义为“报名截止前至少一个团成功”**

### 2.2 拼团规则

* 拼团是课程下的子实体
* 一个课程下可以有多个历史团
* 同一时刻仅允许一个 `active` 团
* 团状态固定为：
  * `active`
  * `success`
  * `failed`
* 新建团时，`expire_time` 统一等于课程报名截止时间
* 只有支付成功后才真正入团：
  * 写入 `group_members`
  * 更新 `groups.current_count`
* 同一用户同一课程只能成功参团一次
  * 仅按成功团 / 成功订单判断
  * 不按失败团成员关系判断

### 2.3 拼团失败退款规则

课程在报名截止前无成功团时：

* 课程状态变为 `拼团失败`
* 相关进行中的团状态改为 `failed`
* 相关订单状态改为 `refunded`
* 保留 `group_members` 记录，不删除
* 自动退款原因统一为：
  * `报名截止前未成团，系统自动退款`


## 3. 当前代码状态

### 3.1 后端已完成

主要文件：

* [server.js](/Users/yun/lindong/backend/server.js)
* [courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)
* [courses.js](/Users/yun/lindong/backend/routes/admin/courses.js)
* [orders.js](/Users/yun/lindong/backend/routes/admin/orders.js)
* [groups.js](/Users/yun/lindong/backend/routes/admin/groups.js)
* [orders.js](/Users/yun/lindong/backend/routes/orders.js)
* [groups.js](/Users/yun/lindong/backend/routes/groups.js)

已完成的能力：

* 课程状态统一由后端计算
* 服务启动后会定时同步课程生命周期
* 创建拼团时，团截止时间等于课程报名截止时间
* 课程失败时自动退款标记
* 拼团管理接口骨架已搭好

当前已有管理端接口：

* `GET /api/admin/groups`
* `GET /api/admin/groups/:id`
* `GET /api/admin/groups/:id/orders`
* `GET /api/admin/courses/:id/groups`

### 3.2 前端已完成

主要文件：

* [App.tsx](/Users/yun/lindong/console/src/App.tsx)
* [AdminLayout.tsx](/Users/yun/lindong/console/src/components/AdminLayout.tsx)
* [CourseListPage.tsx](/Users/yun/lindong/console/src/pages/CourseListPage.tsx)
* [OrderListPage.tsx](/Users/yun/lindong/console/src/pages/OrderListPage.tsx)
* [GroupListPage.tsx](/Users/yun/lindong/console/src/pages/GroupListPage.tsx)
* [GroupDetailPage.tsx](/Users/yun/lindong/console/src/pages/GroupDetailPage.tsx)

已完成的页面能力：

* 课程列表支持查看课程下拼团
* 拼团管理一级导航已接入
* 拼团列表页可查看：
  * 拼团ID
  * 所属课程
  * 状态
  * 当前人数 / 成团人数
  * 开团人
  * 团截止时间
  * 创建时间
* 拼团详情页可查看：
  * 团基础信息
  * 成员信息
  * 关联订单
  * 退款原因
  * 异常提示
* 从拼团详情页可跳到订单管理页查看具体订单


## 4. 当前文档状态

本轮已更新：

* 总 PRD：
  [console_prd.md](/Users/yun/lindong/docs/console/console_prd.md)
* 拼团管理专项计划：
  [console_group_management_plan.md](/Users/yun/lindong/docs/console/console_group_management_plan.md)

文档已明确：

* 课程状态机
* 拼团规则
* 自动退款规则
* 拼团管理只做 P0 / P1
* 当前不做高风险人工改数能力


## 5. 已完成验证

### 5.1 课程状态机验证脚本

文件：

* [verify-course-lifecycle.js](/Users/yun/lindong/backend/scripts/verify-course-lifecycle.js)

命令：

```bash
cd /Users/yun/lindong/backend
npm run verify:course-lifecycle
```

已验证通过的场景：

* 报名截止前无成功团时保持 `拼团中`
* 报名截止前至少一个团成功时进入 `等待上课`
* 到开课时间后进入 `上课中`
* 到结束时间后进入 `已结课`
* 报名截止时仍无成功团则进入 `拼团失败`

### 5.2 拼团规则验证脚本

文件：

* [verify-group-rules.js](/Users/yun/lindong/backend/scripts/verify-group-rules.js)

命令：

```bash
cd /Users/yun/lindong/backend
npm run verify:group-rules
```

已验证通过的场景：

* 新拼团 `expire_time` 等于课程报名截止时间
* 拼团失败自动退款时保留 `group_members`
* 失败团成员记录不会拦截未来再次参团
* 成功团或成功订单仍会拦截重复成功参团


## 6. 当前未完成项

虽然拼团管理骨架已经搭起来，但还没有完全做完，主要缺口有：

### 6.1 后端

* 拼团详情异常提示还能继续补更多课程状态联动校验
* `admin_log` 已接入账号管理，课程管理与状态同步日志建议继续补关键字段和查看入口

### 6.2 前端

* 拼团详情页还没有做更强的状态标签样式
* 课程列表 / 详情 / 拼团页的状态标签视觉还可以继续统一
* 测试数据导入后还需要跑一次完整联调回归

### 6.3 数据库

如果本地后端报：

* `column courses.publish_time does not exist`

说明还没执行这份 migration：

* [20260326_course_lifecycle.sql](/Users/yun/lindong/backend/migrations/20260326_course_lifecycle.sql)


## 7. 下一步建议

推荐按这个顺序继续：

1. 补齐 `admin_log` 在课程管理 / 状态同步链路中的关键日志
2. 同步 PRD / 交接文档中的课程状态口径，明确“已下架”状态
3. 测试数据导入后执行一轮后台联调回归验证
4. 继续补拼团详情页更清晰的状态标签与异常视觉展示
5. 视需要补一个后台审计日志查看入口


## 8. 当前工作区注意事项

当前本地工作区还有 2 个未提交删除项：

* `console/dist/assets/index-BXNQaAlL.js`
* `console/dist/assets/index-DVpiCmAg.css`

这两个是旧构建产物删除，不影响当前逻辑代码，但如果要保持工作区干净，建议下一次提交时一起收掉。
