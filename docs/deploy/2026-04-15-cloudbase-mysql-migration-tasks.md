# 2026-04-15 CloudBase + MySQL 迁移任务文档

## 1. 文档目标

本文档用于把 CloudBase + MySQL 迁移工作拆成可执行任务，支持排期、分工、验收与上线准备。

对应设计文档：

- [2026-04-15-cloudbase-mysql-migration-design.md](/Users/yun/lindong/docs/deploy/2026-04-15-cloudbase-mysql-migration-design.md)

## 2. 任务分期

建议分为 7 个阶段：

1. 资源准备
2. 数据库设计与迁移脚本
3. 后端数据访问层改造
4. 云托管部署与环境配置
5. 存储与上传迁移
6. 联调、回归与灰度切换
7. 正式切换与观察收尾

## 3. 角色建议

建议最少包含以下角色：

- 后端负责人
- 小程序负责人
- 运营后台负责人
- DBA/数据负责人
- 测试负责人
- 发布负责人

如果团队较小，可以一人兼多角，但每项任务仍建议明确主责人。

## 4. 任务清单

### 阶段 1：资源准备

#### T1.1 CloudBase 环境规划

- 内容：
  - 确认 `develop/trial/release` 三套 CloudBase 环境命名
  - 确认云托管服务命名
  - 确认 MySQL 实例命名与容量
- 产出：
  - 环境资源表
- 主责：
  - 发布负责人
- 前置：
  - 无
- 验收：
  - 三套环境与资源列表可用于后续配置

#### T1.2 域名与访问入口规划

- 内容：
  - 确认小程序 API 服务名与对外域名
  - 确认后台 API 域名
  - 确认支付回调域名
- 产出：
  - 域名映射表
- 主责：
  - 发布负责人
- 前置：
  - T1.1
- 验收：
  - 小程序、后台、支付回调域名方案明确

#### T1.3 密钥与环境变量清单整理

- 内容：
  - 生成 CloudBase 环境变量清单
  - 归类数据库、JWT、微信登录、支付、通知、存储配置
- 产出：
  - 环境变量表
- 主责：
  - 后端负责人
- 前置：
  - T1.1
- 验收：
  - 所有环境变量有来源、有用途、有环境区分

### 阶段 2：数据库设计与迁移脚本

#### T2.1 PostgreSQL 到 MySQL 表结构映射

- 内容：
  - 对照现有迁移脚本输出 MySQL DDL
  - 明确主键、外键、索引、默认值、JSON 字段映射
- 参考：
  - [20260325_admin_console.sql](/Users/yun/lindong/backend/migrations/20260325_admin_console.sql)
  - [20260329_pending_order_guard.sql](/Users/yun/lindong/backend/migrations/20260329_pending_order_guard.sql)
  - [20260401_payment_records.sql](/Users/yun/lindong/backend/migrations/20260401_payment_records.sql)
- 产出：
  - MySQL 建表脚本
- 主责：
  - DBA/数据负责人
- 前置：
  - T1.1
- 验收：
  - 所有核心表均有对应 MySQL 建表定义

当前进度：

- 已新增初始化脚本：
  - `backend/migrations/mysql_init_schema.sql`
- 已补充更适合 CloudBase SQL 控制台分步执行的脚本：
  - `backend/migrations/mysql_step0_admin_users.sql`
  - `backend/migrations/mysql_step1_users.sql`
  - `backend/migrations/mysql_step2_miniprogram_core.sql`
  - `backend/migrations/mysql_step3_seed_visible_course.sql`
  - `backend/migrations/mysql_step4_seed_second_member_success_split.sql`
- 已覆盖当前 repository 已接入的核心表：
  - `users`
  - `courses`
  - `groups`
  - `group_members`
  - `orders`
  - `payment_records`
  - `admin_users`
  - `admin_log`
  - `group_result_subscriptions`
  - `group_result_notification_jobs`
- `mysql_init_schema.sql` 仍保留为完整版结构草案
- 真实 CloudBase SQL 控制台中，优先使用上述分步脚本，成功率明显高于一次性执行完整大 SQL

#### T2.2 条件唯一约束替代方案确认

- 内容：
  - 重点处理 `orders_user_course_pending_unique_idx`
  - 确认 MySQL 实现策略
- 产出：
  - 替代设计说明
- 主责：
  - DBA/数据负责人
- 协作：
  - 后端负责人
- 前置：
  - T2.1
- 验收：
  - 创建 pending 订单的唯一性方案明确

当前进度：

- 已在 `backend/migrations/mysql_init_schema.sql` 中采用 MySQL 生成列方案替代 PostgreSQL 条件唯一索引：
  - `orders.pending_user_course_key`
  - 唯一键：`uniq_orders_pending_user_course`
- 语义保持为：
  - 同一用户 + 同一课程，同一时刻只允许保留一笔 `pending` 订单

#### T2.3 全量迁移脚本准备

- 内容：
  - 设计导出、导入与字段转换脚本
  - 明确表迁移顺序
- 产出：
  - 数据迁移脚本
  - 字段映射表
- 主责：
  - DBA/数据负责人
- 前置：
  - T2.1
- 验收：
  - 测试环境可完成一次完整导数

#### T2.4 数据校验脚本准备

- 内容：
  - 编写表行数、订单状态、支付记录、通知任务对账脚本
- 产出：
  - 数据校验脚本
- 主责：
  - DBA/数据负责人
- 协作：
  - 测试负责人
- 前置：
  - T2.3
- 验收：
  - 可输出结构化校验报告

### 阶段 3：后端数据访问层改造

#### T3.1 新建 MySQL 连接层

- 内容：
  - 新增数据库连接池配置
  - 支持多环境配置
- 产出：
  - `config/db.js` 或同级模块
- 主责：
  - 后端负责人
- 前置：
  - T1.3
- 验收：
  - 本地与测试环境均可连通 MySQL

当前进度：

- 已完成基础文件：
  - `backend/config/db.js`
  - `backend/config/env.js`
- 已补充 MySQL 依赖与环境变量模板
- 已在真实 CloudBase 环境 `tttiyubao-4g141829bdf6a28d` 的 `lindong-api` 服务中验证 MySQL 连通
- 当前在 CloudBase 个人版场景下，已确认采用“公网可访问 MySQL”方案，而非 VPC / 私网方案
- 当前真实运行时以 CloudBase 控制台环境变量为准，本地 `backend/.env` 仅作为开发参考，可能不是最新值

#### T3.2 抽离 repository 层

- 内容：
  - 从直接 Supabase 调用中抽出 repository
  - 先覆盖最核心表
- 产出：
  - `repositories/*`
- 主责：
  - 后端负责人
- 前置：
  - T3.1
- 验收：
  - 业务 service 不再直接依赖 Supabase SDK

当前进度：

- 已完成 repository 目录骨架
- 已完成核心表真实实现：
  - `usersRepository`
  - `adminUsersRepository`
  - `adminLogRepository`
  - `coursesRepository`
  - `groupsRepository`
  - `groupMembersRepository`
  - `ordersRepository`
  - `paymentRecordsRepository`
  - `groupResultSubscriptionsRepository`
  - `groupResultNotificationJobsRepository`
- 已在小程序主链路、后台查询链路、通知任务链路中逐步接入
- 仍待继续收敛部分 service 中保留的 Supabase fallback 分支

#### T3.3 迁移用户与鉴权链路

- 内容：
  - 替换小程序登录用户查询
  - 替换后台登录与账号查询
- 涉及：
  - `users`
  - `admin_users`
- 主责：
  - 后端负责人
- 前置：
  - T3.2
- 验收：
  - 小程序登录、后台登录均通过

当前进度：

- 已完成第一阶段：
  - 小程序登录已支持走 `usersRepository`
  - 后台管理员存储已支持走 `adminUsersRepository`
  - 后台日志写入已支持走 `adminLogRepository`
- 已引入微信官方 CloudBase 模板参考实现思路：
  - 参考项目：`.reference/miniprogram-3`
  - 已按官方 `callContainer` / 云函数透传模式兼容 `X-WX-OPENID` / `X-WX-APPID` / `X-WX-UNIONID`
  - 小程序登录服务已支持优先读取 CloudBase 透传身份，其次再回落到 `code2Session`
- 已新增可选小程序身份解析入口：
  - `backend/shared/utils/miniProgramIdentity.js`
  - 读取链路优先使用 CloudBase 透传身份头解析用户，Bearer token 仅作为非 CloudBase 场景兜底
- 已增加可信 CloudBase 入口校验策略：
  - 新增 `TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY`，默认 `false`
  - `backend/miniprogram-container/app.js` 默认启用该信任入口，综合后端/后台公开 HTTP 入口默认不启用
  - `X-WX-*` 身份头仅在信任开关开启且请求带 `X-WX-SERVICE` 的 `callContainer` 场景下解析；其他场景回退到 Bearer token 或按未登录处理
  - 已补充伪造 `X-WX-OPENID` 不应绕过鉴权的单元测试
- 已新增可选联调观测开关：
  - `ENABLE_MINIPROGRAM_IDENTITY_LOGS=false` 默认关闭
  - 打开后会在登录、课程 active-group、拼团详情、创建订单、支付准备、mock 支付成功、“我的拼团”、订阅记录接口输出 `cloudbase` / `bearer` / `anonymous` 身份来源
  - 日志不输出完整 openid，仅输出是否存在用户、是否存在 Bearer、是否存在微信身份头等低敏感字段
- 已补充后台 `console-api` 路由级 MySQL 验证：
  - `backend/tests/console-api.mysql-routes.test.js`
  - 已覆盖 `/api/admin/login`、`/api/admin/accounts`、超级管理员权限边界
  - 已明确后台链路继续保持标准 HTTP + Bearer token，不接入 CloudBase 小程序身份头
- 已完成本地 `console-api` 直连真实 CloudBase MySQL 联调：
  - `POST /api/admin/login` 返回 `code=0`
  - `GET /api/admin/accounts` 返回管理员账号列表
  - `GET /api/admin/logs` 返回登录日志
- 已修复 MySQL `DATETIME` 读取时区偏移：
  - `backend/config/db.js` 使用 `timezone: '+08:00'`
  - 操作日志页面已确认显示北京时间
- 仍待完成：
  - 测试/云托管环境的 `console-api` 课程、订单真实写链路联调

#### T3.4 迁移课程、拼团、订单主链路

- 内容：
  - 迁移课程查询与写入
  - 迁移拼团、团成员、订单读写
- 涉及：
  - `courses`
  - `groups`
  - `group_members`
  - `orders`
- 主责：
  - 后端负责人
- 前置：
  - T3.2
- 验收：
  - 课程浏览、创建订单、支付后成团链路通过

当前进度：

- 已补齐首批 MySQL repository：
  - `coursesRepository`
  - `groupsRepository`
  - `groupMembersRepository`
  - `ordersRepository`
- 已将以下小程序主链路切到 `USE_MYSQL_REPOSITORIES=true` 分支：
  - 课程详情读取
  - 活跃拼团读取
  - 创建 pending 订单
  - mock 支付成功后的成团更新
- 已将课程/拼团读取链路继续接入 CloudBase 透传身份：
  - `/api/courses/:id/active-group` 会优先根据 `X-WX-OPENID` 查用户并计算 `userJoined`
  - `/api/groups/:id` 已验证可仅依赖 `X-WX-OPENID` 通过鉴权，不再要求同时携带 Bearer token
- 已补齐无 Bearer 的 CloudBase 透传身份专项路由测试：
  - `/api/orders`
  - `/api/orders/:id`
  - `/api/payments/prepare`
  - `/api/payments/mock-success`
  - `/api/user/groups`
  - `/api/user/group-result-subscriptions`
- 已确认小程序前端主链路通过统一 `request/get/post` 封装走 `callContainer` transport，container 模式默认不主动拼接 `Authorization`
- 已明确当前仍需要 Bearer token 的入口边界：
  - 小程序 `callContainer` 主链路默认不依赖 Bearer token
  - 小程序 HTTP fallback / 本地调试回退仍会携带 Bearer token
  - `console-api` / 后台管理接口继续仅走标准 HTTP + Bearer token，不接入 CloudBase 身份头
  - 已将上述规则抽到 `miniprogram/utils/requestPolicy.js`，并补充自动化测试防止后续回归
- 已补充 CORS 允许头：
  - `X-WX-OPENID`
  - `X-WX-APPID`
  - `X-WX-UNIONID`
  - `X-WX-SERVICE`
- 已补齐课程生命周期在 MySQL 模式下的状态计算与自动退款分支，避免创建订单前校验仍回落到 Supabase
- 已在真实 CloudBase + MySQL 环境验证通过：
  - 小程序登录
  - 课程列表
  - 课程详情
  - 创建订单
  - 支付准备
  - mock 支付成功
  - 我的拼团
- 已通过 SQL 兜底补第二成员，验证成团状态可同步到详情页与我的拼团
- 已修复 MySQL 中 `groups` 表名导致的 SQL 兼容问题，并同步到真实部署目录代码
- 仍待完成：
  - 第二个真实微信号“去参团”真机链路
  - console 侧课程、订单真实写链路 live smoke

#### T3.5 迁移支付记录与通知任务链路

- 内容：
  - 替换支付记录表访问
  - 替换通知订阅与通知任务表访问
- 涉及：
  - `payment_records`
  - `group_result_subscriptions`
  - `group_result_notification_jobs`
- 主责：
  - 后端负责人
- 前置：
  - T3.4
- 验收：
  - 支付回调、通知投递逻辑通过

当前进度：

- 已补齐首批 MySQL repository：
  - `paymentRecordsRepository`
  - `groupResultSubscriptionsRepository`
  - `groupResultNotificationJobsRepository`
- 已将以下链路切到 `USE_MYSQL_REPOSITORIES=true` 分支：
  - `/api/payments/prepare`
  - `/api/payments/mock-success`
  - `/api/payments/notify/wechat`
  - `/api/user/group-result-subscriptions`
  - 支付成功/失败后通知任务入队
- 已将通知任务消费链路切到 `USE_MYSQL_REPOSITORIES=true` 分支：
  - `groupResultNotificationDelivery`
  - Worker `scheduled` 定时投递入口
  - `/internal/group-result-notifications/process`
- 已支持小程序支付准备在 MySQL 模式下生成/更新 `payment_records`
- 已补充通知任务消费最小测试：
  - `backend/tests/group-result-notification-delivery.test.js`
- 已在真实 CloudBase + MySQL 环境验证 mock 支付成功后支付主链路可继续走通
- 仍待完成：
  - 微信支付真实回调联调
  - 微信订阅消息真实投递联调
  - 生产/测试环境支付密钥配置后的真链路验收

#### T3.6 移除 Supabase 依赖

- 内容：
  - 删除 `@supabase/supabase-js` 依赖
  - 移除 `backend/utils/supabase.js` 的主路径依赖
- 主责：
  - 后端负责人
- 前置：
  - T3.3 ~ T3.5
- 验收：
  - 后端启动与测试不再依赖 Supabase

当前进度：

- 已完成首批核心主链路的 MySQL repository 切换：
  - 用户与管理员鉴权
  - 课程、拼团、订单主链路
  - 支付记录、订阅记录、通知任务入队与消费
- 已去除部分定时任务与内部入口的 Supabase 主路径依赖：
  - `utils/courseLifecycle.js`
  - `routes/internal.js`
  - `worker.mjs`
- 已去除小程序主路由的 Supabase 顶层依赖：
  - `routes/auth.js`
  - `routes/courses.js`
  - `routes/groups.js`
  - `routes/orders.js`
  - `routes/payments.js`
  - `routes/user.js`
- 已兼容 CloudBase `callContainer` 官方透传身份头：
  - 登录支持直接读取 `X-WX-OPENID` / `X-WX-APPID` / `X-WX-UNIONID`
  - 小程序鉴权中间件支持在 MySQL 模式下用 `X-WX-OPENID` 直连用户
- 已补充 MySQL 模式专项验证：
  - `backend/tests/course-lifecycle.mysql.test.js`
  - `backend/tests/miniprogram-routes.mysql.test.js`
  - `backend/tests/auth.middleware.cloudbase.test.js`
- 已完成首批后台查询与看板服务的 MySQL repository 切换：
  - `console-api/services/ordersService.js`
  - `console-api/services/groupsService.js`
  - `console-api/services/coursesService.js`
  - `console-api/services/logService.js`
  - `console-api/services/dashboardService.js`
- 已补充后台 MySQL 模式专项验证：
  - `backend/tests/console-api.mysql-services.test.js`
- 已补充存储配置收敛：
  - `backend/config/storage.js`
  - 已统一 `STORAGE_PROVIDER`、COS 配置、上传大小限制等读取入口
- 当前仍有部分后台与共享服务依赖 `supabase`：
  - `console-api/services/storage/supabaseProvider.js` 与迁移期兼容签名接口
  - `console-api/services/ordersService.js` / `groupsService.js` / `coursesService.js` / `dashboardService.js` / `logService.js` 的 Supabase fallback 与顶层依赖
  - `shared/services/groupOrders.js` / `paymentShell.js` / `groupOrderStore.js` / `groupOrderParticipation.js`
  - `shared/services/groupResultNotifications.js` / `groupResultNotificationDelivery.js`
  - `utils/adminStore.js` 的 Supabase fallback 分支
  - 路由层与 Worker 仍通过 `getSupabaseClient()` 保留旧链路兼容入口
- 因此暂不建议直接删除 `@supabase/supabase-js` 与 `backend/utils/supabase.js`
- 下一步建议：
  - 继续把 `groupOrders` / `paymentShell` / `groupResultNotifications` 这一组核心 service 的 Supabase fallback 收敛到 repository
  - 去掉 console-api 各 service 的 Supabase 顶层依赖，改为按分支延迟加载旧链路客户端
  - 在测试/云托管环境完成 COS 真实上传联调后，再评估是否移除 Supabase storage provider
  - 待 console-api 与定时任务链路全部完成迁移后，再执行依赖清理

### 阶段 4：云托管部署与环境配置

#### T4.1 云托管镜像/源码部署整理

- 内容：
  - 明确部署目录
  - 适配 CloudBase 云托管构建
- 参考：
  - [backend/Dockerfile](/Users/yun/lindong/backend/Dockerfile)
- 主责：
  - 后端负责人
- 协作：
  - 发布负责人
- 前置：
  - T3.1
- 验收：
  - 测试环境服务可启动并通过 `/health`

当前进度：

- 已确认 CloudBase 控制台当前真实采用“本地文件夹上传”部署
- 当前真实部署目录不是直接用 `backend/`，而是：
  - `deploy-artifacts/lindong-api-deploy`
- 已验证该目录可成功部署并拉起 `lindong-api`
- 已明确当前排障约束：
  - 如果只修改 `backend/` 而不更新 `deploy-artifacts/lindong-api-deploy/`，重新部署不会带上最新修复
- 仍待完成：
  - 把“源码改动 -> 更新 deploy-artifacts -> 上传部署”流程脚本化，避免手工同步遗漏

#### T4.2 部署小程序 API 服务

- 内容：
  - 部署 `lindong-api`
  - 绑定 CloudBase 环境变量
- 主责：
  - 发布负责人
- 前置：
  - T4.1
- 验收：
  - 小程序通过 `callContainer` 能调通登录与课程接口

当前进度：

- 已在真实环境完成服务部署：
  - CloudBase 环境 ID：`tttiyubao-4g141829bdf6a28d`
  - 服务名：`lindong-api`
  - 小程序真实 AppID：`wxf18a9c72d851ef7a`
- 已完成 `wx.cloud.init` 与 `callContainer` 主链路接通
- 已验证真实小程序可通过 `callContainer` 调通：
  - `/api/auth/login`
  - `/api/courses`
  - 课程详情、创建订单、支付准备、mock 支付成功、我的拼团
- 已解决此前联调中出现的典型问题：
  - `wx.cloud.init` 未初始化
  - 小程序与 CloudBase 环境未关联
  - `INVALID_HOST`
  - MySQL 连通与表缺失

联调补充说明：

- 小程序侧可直接参考 `.reference/miniprogram-3` 中 CloudBase 官方模板的调用方式：
  - `wx.cloud.init({ env, traceUser: true })`
  - `new wx.cloud.Cloud({ resourceEnv }).callContainer(...)`
- 后端已兼容官方模板透传的微信身份头：
  - `X-WX-OPENID`
  - `X-WX-APPID`
  - `X-WX-UNIONID`
- 因此测试环境联调时，应优先专项验证“仅依赖 CloudBase 透传头”的登录、课程 active-group 与拼团详情路径；Bearer token 方案仅作为非 CloudBase 调用兜底

仍待补齐的官方模板接入任务：

- 后端安全：
  - 已通过 `TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY` 将 `X-WX-*` 身份头限制在小程序云托管入口，公开后台域名或非 CloudBase 域名请求默认不信任客户端自带身份头
  - 已要求可信身份头请求同时带 `X-WX-SERVICE`，并补充伪造身份头不应绕过鉴权测试
- 后端路由：
  - 已为 `/api/orders`、`/api/orders/:id`、`/api/payments/prepare`、`/api/payments/mock-success`、`/api/user/groups`、`/api/user/group-result-subscriptions` 补充“仅可信 `X-WX-OPENID`、无 Bearer token”测试
  - 继续保留 Bearer token 回退测试，作为非 CloudBase 调用和本地调试兜底
- 小程序前端：
  - 已将主链路请求封装成官方模板风格的 `wx.cloud.Cloud({ resourceEnv }).callContainer(...)`
  - 已新增 `miniprogram/utils/callContainerApi.js`
  - 已调整 `miniprogram/utils/request.js`，CloudBase container transport 默认不再主动拼接 `Authorization`
  - 登录返回 token 仍作为兼容字段保留；HTTP fallback / 本地调试仍可使用 Bearer token
  - 对 develop/trial/release 分环境配置 `env`、`resourceEnv`、服务名和路径前缀
- 联调验收：
  - 在 CloudBase 测试环境用真机验证 `X-WX-OPENID` 是否由平台自动透传到后端
  - 用服务端日志确认登录、课程 active-group、拼团详情、创建订单、支付准备、“我的拼团”均命中 CloudBase 身份路径
  - 验证缺失或伪造 `X-WX-OPENID` 的公开请求会被拒绝或回退到 Bearer token

#### T4.3 部署后台 API 服务

- 内容：
  - 部署 `lindong-admin-api` 或后台统一服务
  - 配置后台公开域名
- 主责：
  - 发布负责人
- 前置：
  - T4.1
- 验收：
  - 后台前端能访问登录与基础列表接口

#### T4.4 配置环境变量与密钥

- 内容：
  - 配置 MySQL、JWT、微信支付、通知模板、存储密钥
- 主责：
  - 发布负责人
- 协作：
  - 后端负责人
- 前置：
  - T1.3
- 验收：
  - 服务启动时无配置缺失

当前进度：

- CloudBase `lindong-api` 已完成真实运行所需的 MySQL 连接配置，并验证登录可用
- 当前个人版实际采用公网 MySQL 连接方案
- 当前真实运行时应以 CloudBase 控制台环境变量为准，不应以本地 `backend/.env` 是否最新作为判断依据
- 已补充后台管理员初始化脚本：
  - `backend/migrations/mysql_step0_admin_users.sql`
- `console-api` 在 MySQL 模式下已补上“登录前确保 bootstrap 管理员存在”的运行时兜底
- 仍待补齐：
  - 正式微信支付密钥
  - 正式订阅消息模板配置
  - console 侧若独立部署所需的对应环境变量

### 阶段 5：存储与上传迁移

#### T5.1 确认上传策略

- 内容：
  - 确定第一阶段采用“服务端代理上传”还是“临时凭证直传”
- 建议：
  - 第一阶段先代理上传
- 主责：
  - 后端负责人
- 协作：
  - 运营后台负责人
- 前置：
  - T1.1
- 验收：
  - 上传方案评审通过

当前进度：

- 已按设计文档确认第一阶段采用“服务端代理上传”
- 原因：
  - 当前 `mini-express` 对二进制请求体支持有限，直接透传文件风险较高
  - 后台上传量预计较小，第一阶段优先降低前端直传签名复杂度
  - 后续可在 provider 层替换为 COS/CloudBase 存储，不影响 console 前端调用

#### T5.2 实现新的上传接口

- 内容：
  - 替换 Supabase Storage 依赖
  - 接入 CloudBase 存储或 COS
- 参考：
  - [backend/console-api/services/uploadService.js](/Users/yun/lindong/backend/console-api/services/uploadService.js)
- 主责：
  - 后端负责人
- 前置：
  - T5.1
- 验收：
  - 后台可上传封面、图集、教练证书

当前进度：

- 已新增代理上传接口：
  - `POST /api/admin/upload/image`
- 已保留旧签名接口用于迁移期兼容：
  - `POST /api/admin/upload/sign`
- 已将后台前端上传入口切到代理上传接口：
  - [console/src/lib/api.ts](/Users/yun/lindong/console/src/lib/api.ts)
- 已抽出存储 provider 入口：
  - 当前默认 `STORAGE_PROVIDER=supabase`
  - 已支持 `STORAGE_PROVIDER=cos`
  - 后续切 CloudBase 时仅需新增 provider 实现
- 已新增统一存储配置模块：
  - `backend/config/storage.js`
  - 已统一 provider 选择、COS 参数、上传大小限制配置，减少 `uploadService` / provider 层散落读取环境变量
- 已补充上传 provider 最小测试：
  - `backend/tests/upload-service.providers.test.js`
- 仍待完成：
  - 云托管环境配置 `STORAGE_PROVIDER`、`COS_BUCKET`、`COS_REGION`、`COS_SECRET_ID`、`COS_SECRET_KEY`
  - 如需 CDN/自定义域名，补充 `COS_PUBLIC_BASE_URL`
  - COS 真实图片上传联调

#### T5.3 切换后台上传前端逻辑

- 内容：
  - 适配新的上传响应结构
- 参考：
  - [console/src/lib/api.ts](/Users/yun/lindong/console/src/lib/api.ts)
- 主责：
  - 运营后台负责人
- 前置：
  - T5.2
- 验收：
  - 后台表单上传与预览正常

当前进度：

- 已将 `uploadImage` 从“获取 Supabase 签名后前端 PUT 直传”切为“读取 base64 后调用后端代理上传”
- 表单调用点无需改动，仍统一使用 `uploadImage(file, folder)`
- 仍待完成：
  - 后台页面真实上传与预览回归
  - 大图上传失败、非图片文件、超限文件专项验证

### 阶段 6：联调、回归与灰度切换

#### T6.1 小程序联调

- 内容：
  - 登录
  - 首页课程
  - 课程详情
  - 创建订单
  - 支付确认
  - 支付结果
  - 我的拼团
- 主责：
  - 小程序负责人
- 协作：
  - 后端负责人
- 前置：
  - T4.2
- 验收：
  - 小程序主链路全部通过

当前进度：

- 已在真实 CloudBase + MySQL 环境完成主链路联调：
  - 登录
  - 首页课程列表
  - 课程详情
  - 创建订单
  - 支付准备
  - mock 支付成功
  - 我的拼团
- 已通过 SQL 兜底补第二成员，验证成团状态可被页面正确读出
- 当前剩余缺口：
  - 第二个真实微信号“去参团”真机回归
  - 真支付、真通知链路

联调补充说明：

- 小程序若基于 `.reference/miniprogram-3` 官方模板继续二次开发，建议优先验证以下路径：
  - 通过 `callContainer` 触发登录接口，由 CloudBase 透传 `X-WX-OPENID`
  - 登录后继续访问课程详情、活动拼团、创建订单、支付准备接口，其中活动拼团读取应优先通过 `X-WX-OPENID` 计算当前用户参与状态
  - 已登录状态下访问拼团详情、“我的拼团”等受保护接口，确认后端可仅基于 CloudBase 透传身份完成鉴权
- 如需兼容非 CloudBase 调用场景，仍保留 `code2Session + Bearer token` 路径作为兜底方案

官方模板接入剩余任务：

- 小程序调用层：
  - 已抽出统一 `callContainerApi` 封装，集中处理 `resourceEnv`、服务名、路径、method、data、错误提示
  - 已通过现有 `get/post/request` 封装将课程列表、课程详情、活跃拼团、拼团详情、创建订单、订单状态、支付准备、mock 支付成功、“我的拼团”、订阅结果接口统一接入 container transport
  - 保留旧 HTTP + Bearer 调用开关，便于本地调试和回滚，但默认不再作为 CloudBase 小程序主链路
- 后端联调观测：
  - 已新增 `ENABLE_MINIPROGRAM_IDENTITY_LOGS` 开关，在登录、课程 active-group、拼团详情、创建订单、支付准备、mock 支付成功、“我的拼团”、订阅结果接口按需记录身份来源：`cloudbase` / `bearer` / `anonymous`
  - 日志默认关闭，开启后仅输出低噪声结构化字段，避免输出完整 openid 等敏感标识
- 真机验收：
  - develop 环境先跑完整链路，再推进 trial/release
  - 验证首次登录自动建用户、老用户按 openid 命中原用户、无 token 访问受保护接口仍可用
  - 验证非 CloudBase 请求伪造 `X-WX-OPENID` 不会绕过鉴权

#### T6.2 后台联调

- 内容：
  - 登录
  - 课程管理
  - 拼团管理
  - 订单管理
  - 账号管理
  - 操作日志
  - 图片上传
- 主责：
  - 运营后台负责人
- 协作：
  - 后端负责人
- 前置：
  - T4.3、T5.3
- 验收：
  - 后台主链路全部通过

#### T6.3 定时任务迁移与联调

- 内容：
  - 实现 CloudBase 定时触发
  - 验证课程生命周期同步
  - 验证通知任务投递
- 主责：
  - 后端负责人
- 前置：
  - T3.5、T4.4
- 验收：
  - 定时任务在新环境单独跑通

#### T6.4 测试环境全量导数与回归

- 内容：
  - 将测试数据迁入 CloudBase MySQL
  - 执行全量回归
- 主责：
  - 测试负责人
- 协作：
  - DBA/数据负责人
- 前置：
  - T2.3、T2.4、T6.1、T6.2
- 验收：
  - 输出测试环境回归报告

当前进度：

- 尚未完成严格意义上的“全量导数”
- 当前已完成的是真实 CloudBase MySQL 空库分步初始化与最小回归数据注入：
  - `mysql_step1_users.sql`
  - `mysql_step2_miniprogram_core.sql`
  - `mysql_step3_seed_visible_course.sql`
  - `mysql_step4_seed_second_member_success_split.sql`
- 已基于上述最小数据集完成真实小程序主链路回归

#### T6.5 灰度切流方案确认

- 内容：
  - 明确小程序灰度、后台切换、支付回调切换顺序
  - 明确旧环境只读策略
- 主责：
  - 发布负责人
- 协作：
  - 后端负责人
  - 测试负责人
- 前置：
  - T6.4
- 验收：
  - 切换方案评审通过

### 阶段 7：正式切换与观察收尾

#### T7.1 正式数据迁移

- 内容：
  - 生产数据导出、导入、对账
- 主责：
  - DBA/数据负责人
- 前置：
  - T6.5
- 验收：
  - 生产数据对账通过

#### T7.2 切换小程序正式环境

- 内容：
  - 更新小程序 `release` 指向正式 CloudBase 服务
- 参考：
  - [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)
- 主责：
  - 小程序负责人
- 前置：
  - T7.1
- 验收：
  - 真机主链路通过

当前进度：

- 仓库内 `release` 已指向真实 CloudBase 环境与服务：
  - `release.transport = container`
  - `release.cloudEnv = tttiyubao-4g141829bdf6a28d`
  - `release.service = lindong-api`
- 项目配置中的正式 AppID 已更新为：
  - `wxf18a9c72d851ef7a`
- 当前仍待：
  - 真支付、真通知联调后再做最终正式发布确认

#### T7.3 切换后台 API

- 内容：
  - 更新后台 API 地址
- 参考：
  - [console/.env.example](/Users/yun/lindong/console/.env.example)
- 主责：
  - 运营后台负责人
- 前置：
  - T7.1
- 验收：
  - 后台主链路通过

#### T7.4 切换支付回调与通知配置

- 内容：
  - 更新微信支付回调地址
  - 更新订阅消息配置
- 主责：
  - 发布负责人
- 协作：
  - 后端负责人
- 前置：
  - T7.1
- 验收：
  - 支付成功到账与通知投递正常

#### T7.5 关闭旧定时任务与旧服务写流量

- 内容：
  - 停止旧 `setInterval`
  - 停止旧 Worker cron
  - 旧库切只读
- 主责：
  - 发布负责人
- 前置：
  - T7.2、T7.3、T7.4
- 验收：
  - 新环境成为唯一执行源

#### T7.6 观察期与收尾

- 内容：
  - 观察 3 到 7 天
  - 统计错误、支付异常、重复订单、通知失败
  - 确认下线旧依赖时间点
- 主责：
  - 发布负责人
- 协作：
  - 全体
- 前置：
  - T7.5
- 验收：
  - 观察期无 P0/P1 故障

## 5. 关键检查清单

### 5.1 数据层

- MySQL 建表脚本已评审
- 核心索引已补齐
- 条件唯一约束替代方案已确认
- 测试环境导数已跑通
- 生产导数校验脚本已准备

### 5.2 服务层

- 后端不再依赖 Supabase SDK
- 登录链路可用
- 创建订单链路可用
- 支付回调链路可用
- 定时任务链路可用

### 5.3 前端与小程序

- 小程序 `callContainer` 指向新服务
- 后台 API 指向新域名
- 上传能力正常
- 课程与订单展示无回归

### 5.4 发布层

- CloudBase 环境变量已补齐
- 支付回调地址已更新
- 旧服务回滚入口已保留
- 旧库只读策略已准备

## 6. 建议排期方式

建议按以下节奏推进：

- 第 1 周：
  - 阶段 1
  - 阶段 2
- 第 2 周：
  - 阶段 3
  - 阶段 4
- 第 3 周：
  - 阶段 5
  - 阶段 6
- 第 4 周：
  - 阶段 7

如果资源更紧张，最低也建议保证：

- 设计评审
- 测试环境全量导数
- 小程序主链路回归
- 后台主链路回归
- 支付回调专项演练

## 7. 建议优先级

### P0

- MySQL 结构设计
- 数据访问层替换
- 登录链路
- 订单与支付链路
- 定时任务单执行源

### P1

- 后台上传迁移
- 操作日志
- 通知订阅与投递
- 后台域名切换

### P2

- 上传直传优化
- 服务拆分进一步细化
- 旧代码清理

## 8. 最终交付物

迁移完成后，建议沉淀以下正式交付物：

- CloudBase 环境资源表
- MySQL DDL 与迁移脚本
- 数据对账脚本与报告
- 上线切换记录
- 回滚手册
- 迁移复盘文档

## 9. 结论

本次迁移可以按“先替换基础设施，再替换数据访问层，最后切正式流量”的思路稳步推进。

执行上最关键的不是一次性完成所有改动，而是始终保证：

- 关系型模型不失真
- 小程序和后台主链路不断
- 支付与定时任务不双跑
- 切换有对账、有回滚、有观察期

只要按这个任务拆法推进，CloudBase + MySQL 迁移是可以落地的，而且比继续维持当前多云混合部署更容易长期维护。
