# 2026-04-19 课包拼团 V2.2 技术方案

## 1. 文档目标

本文档用于把 [prd2.0md.md](/Users/yun/lindong/docs/miniprogram/prd2.0md.md) 中已经确认的课包拼团 V2.2 规则，落成可执行的技术方案。

本文档聚焦：

- 分两期的实施边界
- 数据模型与兼容策略
- 后端服务拆分与复用方式
- 小程序与后台的改造范围
- 关键业务规则的技术落点

本文档不替代任务拆解。执行清单见：

- [2026-04-19-package-group-tasks.md](/Users/yun/lindong/docs/miniprogram/2026-04-19-package-group-tasks.md)

接口口径见：

- [2026-04-19-package-group-api.md](/Users/yun/lindong/docs/miniprogram/2026-04-19-package-group-api.md)

## 2. 当前基线

截至 2026-04-19，仓库已经稳定的基线是：

- 小程序真实环境链路：`wx.cloud.callContainer -> lindong-api -> MySQL`
- 小程序当前主业务：单次课程拼团
- 后台当前主业务：课程 / 拼团 / 订单 / 账号 / 日志
- 后台 `console-api` 已完成真实 MySQL 登录、账号列表、日志列表联调

本次课包拼团改造的原则是：

- 不破坏已经打通的 CloudBase + MySQL 基线
- 不重写整套系统
- 保留旧单次课程模式的数据层
- 新入口只开放课包模式

## 3. 分期策略

## 3.1 第一期

目标：先打通“课包拼团主链路”。

包含：

- 新课包数据模型与迁移脚本
- 小程序课包首页、详情、开团、参团、拼团详情、我的拼团
- 后台课包管理、课包拼团订单管理、课包拼团列表
- 继续使用当前 mock 支付成功链路
- 48 小时截止、自动成团、自动失败退款

不包含：

- 真微信支付
- 真微信退款回调
- 真订阅消息通知
- 运营增强统计、分享优化、复杂筛选

## 3.2 第二期

目标：在第一期稳定后补齐支付、通知和运营增强。

包含：

- 真支付 / 真退款 / 真回调
- 通知模板与投递
- 更细的后台统计和筛选能力
- 运营侧增强配置

## 4. 总体技术路线

## 4.1 架构保持不变

继续沿用当前已验证的双入口架构：

```text
小程序 -> wx.cloud.callContainer -> lindong-api
后台   -> HTTP + JWT              -> console-api
共享业务规则 -> backend/shared/*
数据库 -> CloudBase MySQL
```

本次不改：

- 小程序 `callContainer` 链路
- 后台 JWT 鉴权模型
- `console-api` 作为后台入口的模式

## 4.2 模式兼容策略

采用“双模式并存、单入口开放”的策略：

- 旧单次课程模式：数据保留，代码保留，前台与后台入口隐藏
- 新课包拼团模式：新增数据模型，前台与后台主入口切到该模式

这意味着：

- 第一版不删除旧 `courses / groups / orders(type=1)` 逻辑
- 第一版不让旧模式继续演进
- 后续如果要恢复旧模式，只恢复入口，不重做底层

## 5. 数据模型方案

## 5.1 总体建议

采用“新建课包主模型 + 复用订单主表扩展”的折中方案：

- 新建 `course_packages`
- 新建 `package_groups`
- 继续复用 `orders`

不建议：

- 把课包模式硬塞进现有 `courses / groups`
- 再新建第二张独立订单主表

原因：

- 现有 `courses / groups` 语义强绑定“单次课程 + 固定开课时间”
- 课包拼团存在新的目标人数、星期、整点、首课时间和 5 周课次规则
- 订单层继续复用，能保留支付、退款、日志、统计的主链路

## 5.2 物理表建议

为与现有仓库命名风格统一，技术实现建议使用复数表名：

- `course_packages`
- `package_groups`
- `orders`

PRD 中的 `course_package`、`package_group` 继续作为逻辑概念使用。

## 5.3 `course_packages`

建议字段：

- `id char(36)`
- `name varchar(100)`
- `cover varchar(1024)`
- `images json`
- `total_price int`
- `supported_people varchar(32)`
- `location_district varchar(50)`
- `location_community varchar(50)`
- `location_detail varchar(100)`
- `longitude decimal(10,7)`
- `latitude decimal(10,7)`
- `coach_name varchar(50)`
- `coach_intro text`
- `coach_certificates json`
- `description mediumtext`
- `deadline_hours int default 48`
- `status tinyint`
- `created_at datetime`
- `updated_at datetime`
- `created_by char(36) null`
- `updated_by char(36) null`

说明：

- `supported_people` 第一版用逗号分隔字符串，如 `2,4,6,8`
- API 返回层统一转成数组，如 `[2,4,6,8]`
- `deadline_hours` 第一版虽然固定 48，但字段仍保留，为第二期扩展留口

## 5.4 `package_groups`

建议字段：

- `id char(36)`
- `package_id char(36)`
- `creator_id char(36)`
- `target_count int`
- `current_count int`
- `status varchar(20)`：
  - `active`
  - `success`
  - `failed`
- `weekday tinyint`
- `hour tinyint`
- `first_class_time datetime null`
- `deadline datetime`
- `created_at datetime`
- `success_time datetime null`

说明：

- 不创建“支付前空团”
- 团长只有支付成功后，才创建正式 `package_groups` 记录
- `current_count` 创建即为 `1`
- `first_class_time` 在成团时锁定，进行中可为 `null`

## 5.5 `orders` 扩展

在现有 `orders` 表上增加字段：

- `order_type tinyint`
  - `1`：单次课程
  - `2`：课包拼团
- `package_id char(36) null`
- `package_group_id char(36) null`
- `package_action varchar(10) null`
  - `start`
  - `join`
- `package_context json null`

`package_context` 用途：

- 仅用于“团长支付前的待支付订单”
- 保存：
  - `target_count`
  - `weekday`
  - `hour`
- 支付成功后：
  - `start` 单创建正式 `package_group`
  - 生成 `package_group_id`
  - 订单绑定到该团

这样可以避免：

- 提前创建 `current_count=0` 的空团
- 额外引入 `package_group_drafts` 表

## 5.6 课包成员数据来源

第一版不单独建 `package_group_members` 表。

成员列表统一以 `orders` 为准：

- `order_type = 2`
- `package_group_id = ?`
- `status = 'success'`

原因：

- 成员资格和支付状态天然绑定
- 失败退款后无需双写删除成员表
- 后台和前台的成员查询可以统一走订单成功记录

`package_groups.current_count` 作为缓存字段保留，用于列表和状态计算。

## 5.7 唯一性约束建议

新增约束：

- 同一用户同一课包，同一时刻只允许一笔 `pending` 订单
- 同一用户同一课包允许存在多笔支付成功订单，用于为多个孩子报名
- 同一用户同一拼团允许多次报名，每笔成功订单占用 1 个名额

技术建议：

- 在 `orders` 新增 `pending_user_package_key` 生成列
- 值规则：
  - `order_type=2 && status='pending'` 时，值为 `user_id:package_id`
  - 其他情况为 `null`
- 唯一键：`uniq_orders_pending_user_package`

“已参与但还可否再次开团/参团”不再按用户维度拦截；服务层只校验拼团是否仍可加入、目标人数是否未满、订单状态是否有效。

## 6. 核心业务规则落点

## 6.1 开团成功定义

规则：

- 团长点击“确认开团并支付”后，不立即创建正式团
- 支付成功后才创建 `package_group`
- 创建后：
  - 团长成为首个成员
  - `current_count = 1`

技术实现：

1. `POST /api/package-orders/start`
   - 创建 `orders(status='pending', order_type=2, package_action='start')`
   - `package_context` 保存 `target_count / weekday / hour`
2. `POST /api/payments/mock-success`
   - 如果是 `start` 单：
     - 创建正式 `package_group`
     - 回填 `orders.package_group_id`
     - 更新订单为 `success`

## 6.2 参团成功定义

规则：

- 用户点击“确认参团并支付”
- 支付成功后，订单加入已存在的 `package_group`
- `current_count + 1`

技术实现：

1. `POST /api/package-orders/join`
   - 创建 `orders(status='pending', order_type=2, package_action='join', package_group_id=...)`
2. `POST /api/payments/mock-success`
   - 如果是 `join` 单：
     - 更新订单为 `success`
     - 更新 `package_groups.current_count`

## 6.3 支付金额规则

规则：

- 每个团员支付金额必须完全一样
- 口径：
  - `member_amount_fen = floor(total_price / target_count)`
- 差额：
  - `platform_subsidy_fen = total_price - member_amount_fen * target_count`

技术要求：

- API 返回 `member_amount_fen`
- 前端统一按两位小数展示
- 后台订单金额以实际支付金额为准

## 6.4 时间规则

进行中：

- 只显示 `每周X HH:00，共5次`
- 不返回具体首课日期给前端做主展示

成团后：

- 以 `success_time` 为基准
- 计算“成功后的第一个所选 weekday + hour”
- 得到 `first_class_time`
- 再生成后续 4 次，每次 +7 天

建议实现两个工具方法：

- `computeFirstPackageClassTime({ successTime, weekday, hour })`
- `buildPackageLessonSchedule({ firstClassTime, weeks: 5 })`

## 6.5 截止时间规则

第一版固定：

- `deadline = group_created_at + 48h`

不做：

- 固定日期截止
- 课包级多规则切换

## 6.6 团状态流转

`active -> success`

条件：

- `current_count >= target_count`

行为：

- 更新 `status='success'`
- 写入 `success_time`
- 计算并写入 `first_class_time`
- 拒绝后续继续参团

`active -> failed`

条件：

- `deadline <= now`
- `current_count < target_count`

行为：

- 更新 `status='failed'`
- 找出该团全部 `success` 订单
- 进入退款流程
- 订单状态更新为 `refunded`

## 7. 后端模块改造

## 7.1 Repository 层

新增：

- `packageGroupsRepository`
- `coursePackagesRepository`

扩展：

- `ordersRepository`
- `paymentRecordsRepository`

## 7.2 Shared Service 层

新增：

- `packageGroupRules`
- `packageReaders`
- `packageOrders`
- `packageSchedule`

扩展：

- 支付成功回调处理
- 自动失败退款处理

## 7.3 路由层

小程序新增：

- `/api/packages`
- `/api/package-groups`
- `/api/package-orders`
- `/api/user/package-groups`

后台新增：

- `/api/admin/packages`
- `/api/admin/package-groups`
- `/api/admin/package-orders`

旧路由：

- 保留但不再作为主链路继续扩展

## 7.4 定时任务

需要新增/复用一条定时任务：

- 扫描 `package_groups.status='active' && deadline <= now`
- 将未成团的团更新为失败
- 触发退款任务

第一期仍可沿用当前定时任务基础设施，不要求立刻重构成新平台。

## 8. 小程序改造范围

需要新增或重写的页面主链路：

- 首页：从课程卡片切到课包卡片
- 课包详情页
- 开团页
- 参团页
- 拼团详情页
- 我的拼团列表

需要调整的点：

- 课程字段口径改为课包字段
- `activeGroup` 口径改为 `activePackageGroups`
- 进行中与已成团的时间展示口径不同
- 当前支付链路继续复用 `prepare/mock-success`，但订单类型变为课包拼团

## 9. 后台改造范围

第一版后台只开放课包主流程：

- 课包管理
- 课包拼团记录查看
- 课包拼团订单查看
- 手动退款

第一版不继续演进：

- 旧单次课程管理 UI
- 旧单次课程相关运营能力

## 10. 风险与控制

## 10.1 主要风险

- 旧课程逻辑与新课包逻辑混写，导致回归范围失控
- 订单表扩展后兼容旧课程订单查询
- 支付成功后才创建团，需要保证幂等
- 自动退款任务与人工退款任务冲突

## 10.2 控制策略

- 新接口、新服务、新表优先，不在旧接口上硬改语义
- 订单表扩展但不新建第二张订单主表
- `mock-success` 和后续真支付回调都必须按订单状态做幂等
- 后台退款必须校验当前订单状态和团状态

## 11. 第一阶段验收口径

- 小程序首页只展示课包
- 详情页展示进行中团列表，不显示团长昵称
- 团长支付成功后才真正生成团
- 同一用户可对同一课包或同一拼团多次报名，人数按支付成功订单名额累计
- 进行中团展示“每周X HH:00，共5次”
- 成团后展示 5 次具体时间
- 48 小时到期未成团可自动失败并退款
- 后台可管理课包、查看课包团、查看订单并手动退款
