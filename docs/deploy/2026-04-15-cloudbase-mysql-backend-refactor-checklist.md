# 2026-04-15 CloudBase + MySQL 后端改造清单

## 1. 文档目标

本文档用于把 `backend/` 目录下与 `CloudBase + MySQL` 迁移相关的后端改造点，细化到文件和模块级别，方便直接派工、排期和验收。

本文档配套以下两份文档使用：

- [CloudBase + MySQL 迁移设计文档](/Users/yun/lindong/docs/deploy/2026-04-15-cloudbase-mysql-migration-design.md)
- [CloudBase + MySQL 迁移任务文档](/Users/yun/lindong/docs/deploy/2026-04-15-cloudbase-mysql-migration-tasks.md)

## 2. 改造原则

本次后端改造遵循以下原则：

- 优先替换基础设施和数据访问层，不重写业务规则
- 保留现有 API 形状与错误口径，减少前端回归
- 保留 JWT 鉴权，不在本阶段引入 CloudBase Auth 重构
- 先抽 repository，再替换路由/服务内部查询
- 定时任务只保留一个执行源
- 存储迁移与数据库迁移解耦推进

## 3. 当前后端结构总览

当前 `backend/` 可按迁移关注点分为以下几组：

- 运行入口
- 路由层
- 业务服务层
- 管理后台服务层
- 通用工具与存储
- 脚本与测试
- 废弃或迁移后清理项

关键入口文件：

- [app.js](/Users/yun/lindong/backend/app.js)
- [server.js](/Users/yun/lindong/backend/server.js)
- [miniprogram-container/app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
- [miniprogram-container/server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
- [worker.mjs](/Users/yun/lindong/backend/worker.mjs)

## 4. 推荐目标目录

建议在不一次性大迁目录的前提下，逐步引入以下结构：

```text
backend/
├── config/
│   ├── db.js
│   ├── env.js
│   └── storage.js
├── repositories/
│   ├── usersRepository.js
│   ├── adminUsersRepository.js
│   ├── coursesRepository.js
│   ├── groupsRepository.js
│   ├── groupMembersRepository.js
│   ├── ordersRepository.js
│   ├── paymentRecordsRepository.js
│   ├── groupResultSubscriptionsRepository.js
│   ├── groupResultNotificationJobsRepository.js
│   └── adminLogRepository.js
├── services/
│   └── 可选，用于后续沉淀跨路由 service
├── ...
```

说明：

- 不要求一次性迁目录
- 第一阶段可以只新增 `config/` 和 `repositories/`
- 老代码逐步改为从 repository 读写数据库

## 5. 模块级改造清单

### 5.1 运行入口与部署层

#### A1 [backend/package.json](/Users/yun/lindong/backend/package.json)

当前状态：

- 仍包含 `@supabase/supabase-js`
- 仍包含 `cf:*` 相关脚本

改造动作：

- 移除 `@supabase/supabase-js`
- 增加 MySQL 驱动或 ORM 依赖
- 保留 `miniprogram-container:start`
- 视迁移节奏决定是否保留 `cf:dev` / `cf:deploy`

完成标志：

- 后端依赖树不再依赖 Supabase SDK
- 本地开发与云托管构建均可通过

#### A2 [backend/Dockerfile](/Users/yun/lindong/backend/Dockerfile)

当前状态：

- 只复制 `lib`、`middleware`、`miniprogram-container`、`routes`、`shared`、`utils`
- 没有预留 `config/`、`repositories/`

改造动作：

- 将新增的 `config/`、`repositories/` 纳入构建
- 如后台 API 与小程序 API 仍共用镜像，确认 `console-api/` 是否纳入镜像
- 统一以 CloudBase 云托管作为主部署目标

完成标志：

- CloudBase 云托管镜像包含新数据库访问层
- 测试环境部署成功

#### A3 [backend/app.js](/Users/yun/lindong/backend/app.js)

当前状态：

- 作为综合后端入口
- 路由挂载清晰，业务不重

改造动作：

- 保持主体不变
- 路由层内部逐步切到 MySQL repository
- 如需要拆分后台独立服务，可保留此文件为聚合入口

完成标志：

- 不依赖 Supabase 初始化
- 仍可作为综合 API 入口

#### A4 [backend/miniprogram-container/app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)

当前状态：

- 是小程序云托管专用入口
- 已适配当前 `callContainer` 路由

改造动作：

- 保持入口结构不变
- 内部业务切到 MySQL repository
- 继续作为 CloudBase 主入口

完成标志：

- 小程序环境通过 `callContainer` 调用新服务成功

#### A5 [backend/server.js](/Users/yun/lindong/backend/server.js)

当前状态：

- 包含 `setInterval` 课程生命周期同步

改造动作：

- 保留本地开发场景可选定时逻辑
- 生产环境停止使用该文件作为唯一调度入口
- 增加环境开关，防止重复调度

完成标志：

- 生产环境无 `setInterval` 双跑风险

#### A6 [backend/worker.mjs](/Users/yun/lindong/backend/worker.mjs)

当前状态：

- 用于 Cloudflare Worker 定时任务
- 依赖 Supabase 与 Worker `scheduled()`

改造动作：

- 标记为迁移过渡文件
- 迁移到 CloudBase 后停止作为生产主链路
- 迁移完成后删除或归档

完成标志：

- 生产定时任务不再依赖 Cloudflare Worker

### 5.2 数据库连接与基础设施层

#### B1 [backend/utils/supabase.js](/Users/yun/lindong/backend/utils/supabase.js)

当前状态：

- 是当前所有数据读写的统一入口

改造动作：

- 新增 `backend/config/db.js`
- 迁移期间逐步替换对本文件的引用
- 最终删除本文件

完成标志：

- 代码库中不再引用 `utils/supabase.js`

#### B2 新增 `backend/config/db.js`

改造动作：

- 建立 MySQL 连接池
- 支持多环境配置
- 提供查询、事务、连接管理基础能力

完成标志：

- 所有 repository 统一通过该模块访问数据库

当前进度：

- 已完成基础骨架
- 已支持连接池、查询、执行、事务封装
- 仍待接入更多业务 repository

#### B3 新增 `backend/config/env.js`

改造动作：

- 统一读取和校验环境变量
- 替代散落在各文件中的 `process.env.*`

完成标志：

- 数据库、支付、通知、存储等配置统一从该模块读取

#### B4 新增 `backend/config/storage.js`

改造动作：

- 统一封装 CloudBase 存储/COS 配置
- 给上传服务和后续文件 URL 生成提供基础能力

完成标志：

- 上传逻辑不再依赖 Supabase Storage API

### 5.3 Repository 层新增清单

建议新增以下 repository 文件，并按这组次序推进：

#### C1 `backend/repositories/usersRepository.js`

用途：

- 根据 `openid` 查用户
- 创建用户
- 通过 `id` 查用户

优先替换调用方：

- [shared/services/miniProgramAuth.js](/Users/yun/lindong/backend/shared/services/miniProgramAuth.js)
- [shared/services/paymentShell.js](/Users/yun/lindong/backend/shared/services/paymentShell.js)
- [routes/user.js](/Users/yun/lindong/backend/routes/user.js)

当前进度：

- 已完成首版真实实现
- 已在小程序登录链路接入
- 仍待扩展更多用户查询场景

#### C2 `backend/repositories/adminUsersRepository.js`

用途：

- 管理员查询、创建、更新、删除
- 登录信息更新
- 超级管理员数量校验

优先替换调用方：

- [utils/adminStore.js](/Users/yun/lindong/backend/utils/adminStore.js)
- [console-api/services/authService.js](/Users/yun/lindong/backend/console-api/services/authService.js)
- [console-api/services/accountService.js](/Users/yun/lindong/backend/console-api/services/accountService.js)

当前进度：

- 已完成首版真实实现
- 已通过 `adminStore` 接入后台管理员主链路
- `authService`、`accountService` 现可经 `adminStore` 间接使用新仓储

#### C3 `backend/repositories/adminLogRepository.js`

用途：

- 写操作日志
- 查询后台日志

优先替换调用方：

- [utils/adminStore.js](/Users/yun/lindong/backend/utils/adminStore.js)
- [console-api/services/logService.js](/Users/yun/lindong/backend/console-api/services/logService.js)
- [utils/courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

当前进度：

- 已完成首版真实实现
- 已通过 `adminStore.writeAdminLog()` 接入
- `logService` 查询侧仍待直接切换

#### C4 `backend/repositories/coursesRepository.js`

用途：

- 课程列表、详情、创建、更新、下架
- 生命周期相关字段查询

优先替换调用方：

- [routes/courses.js](/Users/yun/lindong/backend/routes/courses.js)
- [console-api/services/coursesService.js](/Users/yun/lindong/backend/console-api/services/coursesService.js)
- [shared/services/courseReaders.js](/Users/yun/lindong/backend/shared/services/courseReaders.js)
- [utils/courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

#### C5 `backend/repositories/groupsRepository.js`

用途：

- 拼团查询、创建、状态更新、人数更新

优先替换调用方：

- [routes/groups.js](/Users/yun/lindong/backend/routes/groups.js)
- [shared/services/groupOrders.js](/Users/yun/lindong/backend/shared/services/groupOrders.js)
- [shared/services/groupReaders.js](/Users/yun/lindong/backend/shared/services/groupReaders.js)
- [console-api/services/groupsService.js](/Users/yun/lindong/backend/console-api/services/groupsService.js)
- [utils/courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

#### C6 `backend/repositories/groupMembersRepository.js`

用途：

- 团成员查询、插入、删除

优先替换调用方：

- [shared/services/groupOrderParticipation.js](/Users/yun/lindong/backend/shared/services/groupOrderParticipation.js)
- [shared/services/groupReaders.js](/Users/yun/lindong/backend/shared/services/groupReaders.js)
- [console-api/services/groupsService.js](/Users/yun/lindong/backend/console-api/services/groupsService.js)

#### C7 `backend/repositories/ordersRepository.js`

用途：

- 订单创建、查单、列表、状态更新、退款更新

优先替换调用方：

- [routes/orders.js](/Users/yun/lindong/backend/routes/orders.js)
- [shared/services/groupOrderStore.js](/Users/yun/lindong/backend/shared/services/groupOrders.js)
- [shared/services/paymentShell.js](/Users/yun/lindong/backend/shared/services/paymentShell.js)
- [console-api/services/ordersService.js](/Users/yun/lindong/backend/console-api/services/ordersService.js)
- [utils/courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

#### C8 `backend/repositories/paymentRecordsRepository.js`

用途：

- 支付记录创建、更新、状态推进

优先替换调用方：

- [shared/services/paymentShell.js](/Users/yun/lindong/backend/shared/services/paymentShell.js)

#### C9 `backend/repositories/groupResultSubscriptionsRepository.js`

用途：

- 订阅记录写入与查询

优先替换调用方：

- [routes/user.js](/Users/yun/lindong/backend/routes/user.js)
- [shared/services/groupResultNotifications.js](/Users/yun/lindong/backend/shared/services/groupResultNotifications.js)

#### C10 `backend/repositories/groupResultNotificationJobsRepository.js`

用途：

- 通知任务生成、状态更新、待处理任务拉取

优先替换调用方：

- [shared/services/groupResultNotifications.js](/Users/yun/lindong/backend/shared/services/groupResultNotifications.js)
- [shared/services/groupResultNotificationDelivery.js](/Users/yun/lindong/backend/shared/services/groupResultNotificationDelivery.js)

### 5.4 小程序路由层改造

这些文件不建议重写路由结构，建议只替换其 service/repository 依赖。

#### D1 [backend/routes/auth.js](/Users/yun/lindong/backend/routes/auth.js)

改造动作：

- 替换登录逻辑中的用户查找与创建
- 继续保留 JWT 返回结构

完成标志：

- 小程序登录 API 行为不变

#### D2 [backend/routes/courses.js](/Users/yun/lindong/backend/routes/courses.js)

改造动作：

- 替换课程查询、定位、详情、展示逻辑中的数据访问
- 保持返回字段不变

完成标志：

- 小程序课程相关页面无接口层回归

#### D3 [backend/routes/groups.js](/Users/yun/lindong/backend/routes/groups.js)

改造动作：

- 替换拼团查询、列表、详情的数据库调用

完成标志：

- 拼团详情、拼团列表接口通过

#### D4 [backend/routes/orders.js](/Users/yun/lindong/backend/routes/orders.js)

改造动作：

- 替换创建订单与订单状态查询所依赖的 service/repository

完成标志：

- 创建订单、查支付状态通过

#### D5 [backend/routes/payments.js](/Users/yun/lindong/backend/routes/payments.js)

改造动作：

- 保留支付回调和验签逻辑
- 替换支付记录、订单、团状态更新相关数据库操作
- 更新支付回调域名配置来源

完成标志：

- `prepare`
- `notify/wechat`
- `mock-success`
  三条链路全部可用

#### D6 [backend/routes/user.js](/Users/yun/lindong/backend/routes/user.js)

改造动作：

- 替换用户订阅记录和用户信息相关读写

完成标志：

- 拼团结果订阅接口通过

#### D7 [backend/routes/internal.js](/Users/yun/lindong/backend/routes/internal.js)

改造动作：

- 保留保护性内部接口
- 替换其依赖的通知任务与生命周期同步数据访问
- 作为 CloudBase 定时触发器的手动/兼容入口

完成标志：

- 内部同步和通知处理接口在新环境可用

### 5.5 核心业务服务层改造

这些文件是迁移中的重点，不建议边迁边重写业务规则。

#### E1 [backend/shared/services/miniProgramAuth.js](/Users/yun/lindong/backend/shared/services/miniProgramAuth.js)

改造动作：

- 用 `usersRepository` 替换 Supabase 查询
- 保留 `code -> openid -> user -> JWT` 模型

优先级：

- P0

#### E2 [backend/shared/services/courseReaders.js](/Users/yun/lindong/backend/shared/services/courseReaders.js)

改造动作：

- 用 `coursesRepository`、`groupsRepository` 替换数据查询
- 保持课程列表和详情拼装逻辑

优先级：

- P0

#### E3 [backend/shared/services/groupOrderStore.js](/Users/yun/lindong/backend/shared/services/groupOrderStore.js)

改造动作：

- 替换订单、拼团关闭和状态推进的基础查询
- 需要重点考虑 MySQL 下的幂等与事务

优先级：

- P0

#### E4 [backend/shared/services/groupOrderParticipation.js](/Users/yun/lindong/backend/shared/services/groupOrderParticipation.js)

改造动作：

- 替换团成员、团人数和回滚相关查询

优先级：

- P0

#### E5 [backend/shared/services/groupOrders.js](/Users/yun/lindong/backend/shared/services/groupOrders.js)

改造动作：

- 这是拼团主业务核心文件，优先保留业务逻辑
- 只替换数据读写到 repository
- 补事务边界设计

特别关注：

- pending 订单唯一性
- 成团人数推进
- 支付成功幂等
- 退款回滚一致性

优先级：

- P0

#### E6 [backend/shared/services/groupReaders.js](/Users/yun/lindong/backend/shared/services/groupReaders.js)

改造动作：

- 替换团详情、团成员、用户参与状态查询

优先级：

- P1

#### E7 [backend/shared/services/paymentShell.js](/Users/yun/lindong/backend/shared/services/paymentShell.js)

改造动作：

- 保留支付接入和签名逻辑
- 替换订单、用户、支付记录读写
- 增补 MySQL 事务与幂等处理

优先级：

- P0

#### E8 [backend/shared/services/groupResultNotifications.js](/Users/yun/lindong/backend/shared/services/groupResultNotifications.js)

改造动作：

- 替换订阅和通知任务表访问
- 保持消息快照与任务生成逻辑

优先级：

- P1

#### E9 [backend/shared/services/groupResultNotificationDelivery.js](/Users/yun/lindong/backend/shared/services/groupResultNotificationDelivery.js)

改造动作：

- 替换待处理任务拉取和任务状态更新
- 保持微信通知投递逻辑

优先级：

- P1

### 5.6 管理后台服务层改造

#### F1 [backend/utils/adminStore.js](/Users/yun/lindong/backend/utils/adminStore.js)

当前状态：

- 是后台账号和后台日志的核心存储封装
- 与 Supabase 耦合最重
- 包含“表是否存在”和“列是否存在”的兼容逻辑

改造动作：

- 拆为：
  - `adminUsersRepository`
  - `adminLogRepository`
  - `adminPasswordService` 或保留密码工具函数
- 删除 PGRST 相关兼容逻辑
- 保留密码 hash / verify 逻辑

优先级：

- P0

当前进度：

- 已完成第一阶段改造
- 已接入 `adminUsersRepository` 与 `adminLogRepository`
- 仍保留 Supabase 兼容分支，便于迁移期间平滑切换

#### F2 [backend/console-api/services/authService.js](/Users/yun/lindong/backend/console-api/services/authService.js)

改造动作：

- 继续使用 JWT
- 改为依赖 `adminUsersRepository`
- 保留登录日志写入

优先级：

- P0

#### F3 [backend/console-api/services/accountService.js](/Users/yun/lindong/backend/console-api/services/accountService.js)

改造动作：

- 替换 `adminStore` 读写依赖
- 保留现有错误口径

优先级：

- P0

#### F4 [backend/console-api/services/coursesService.js](/Users/yun/lindong/backend/console-api/services/coursesService.js)

改造动作：

- 替换课程、后台写操作、日志写入依赖
- 视情况进一步拆 helper 与 repository 调用

优先级：

- P0

#### F5 [backend/console-api/services/groupsService.js](/Users/yun/lindong/backend/console-api/services/groupsService.js)

改造动作：

- 替换群组、用户、订单聚合查询
- 注意后台异常检测逻辑中的统计口径

优先级：

- P1

#### F6 [backend/console-api/services/ordersService.js](/Users/yun/lindong/backend/console-api/services/ordersService.js)

改造动作：

- 替换订单列表、详情、手动退款依赖
- 重点验证退款回滚逻辑

优先级：

- P0

#### F7 [backend/console-api/services/logService.js](/Users/yun/lindong/backend/console-api/services/logService.js)

改造动作：

- 用 `adminLogRepository` 替换查询

优先级：

- P1

#### F8 [backend/console-api/services/dashboardService.js](/Users/yun/lindong/backend/console-api/services/dashboardService.js)

改造动作：

- 替换统计查询
- 留意聚合与分页性能

优先级：

- P1

#### F9 [backend/console-api/services/uploadService.js](/Users/yun/lindong/backend/console-api/services/uploadService.js)

当前状态：

- 强依赖 Supabase Storage 签名上传

改造动作：

- 重写为 CloudBase 存储/COS 上传方案
- 第一阶段建议实现服务端代理上传
- 如继续保留“签名/令牌”接口，也需重定义返回结构

优先级：

- P1

### 5.7 鉴权中间件

#### G1 [backend/middleware/auth.js](/Users/yun/lindong/backend/middleware/auth.js)

改造动作：

- 原则上可不改
- 如引入 `config/env.js`，则改为统一读取 JWT 配置

优先级：

- P2

#### G2 [backend/middleware/adminAuth.js](/Users/yun/lindong/backend/middleware/adminAuth.js)

改造动作：

- 原则上可不改
- 与 `auth.js` 一样，只做轻量配置层对齐

优先级：

- P2

### 5.8 课程生命周期与定时任务

#### H1 [backend/utils/courseLifecycle.js](/Users/yun/lindong/backend/utils/courseLifecycle.js)

当前状态：

- 直接依赖 Supabase
- 包含自动退款、课程状态同步、后台日志写入

改造动作：

- 替换课程、拼团、订单、日志的数据库依赖
- 保留课程状态计算逻辑
- 明确是否需要事务包裹退款状态推进

优先级：

- P0

#### H2 新增 `backend/jobs/` 或 `backend/triggers/`

建议新增：

- `syncCourseLifecycleJob.js`
- `processGroupResultNotificationJob.js`

用途：

- 把任务入口从 Worker/Node 运行时中抽离出来
- 供 CloudBase 定时触发器或内部接口复用

优先级：

- P1

### 5.9 微信能力与三方服务

#### I1 [backend/shared/services/wechatMiniProgram.js](/Users/yun/lindong/backend/shared/services/wechatMiniProgram.js)

改造动作：

- 基本保留
- 统一通过 `config/env.js` 取配置
- 校验新环境变量命名

优先级：

- P1

#### I2 [backend/shared/services/wechatMiniProgramNotifications.js](/Users/yun/lindong/backend/shared/services/wechatMiniProgramNotifications.js)

改造动作：

- 基本保留
- 改为统一配置读取

优先级：

- P1

#### I3 [backend/console-api/services/tencentMapService.js](/Users/yun/lindong/backend/console-api/services/tencentMapService.js)

改造动作：

- 核查是否继续复用腾讯地图接口
- 将 Key 配置统一纳入新环境变量

优先级：

- P2

### 5.10 脚本与测试改造

#### J1 [backend/scripts/create-test-course.js](/Users/yun/lindong/backend/scripts/create-test-course.js)

改造动作：

- 替换为 MySQL repository
- 保证测试种子仍可生成

优先级：

- P1

#### J2 [backend/scripts/ensure-bootstrap-admin.js](/Users/yun/lindong/backend/scripts/ensure-bootstrap-admin.js)

改造动作：

- 替换管理员查询与创建逻辑

优先级：

- P1

#### J3 [backend/scripts/verify-admin-seed.js](/Users/yun/lindong/backend/scripts/verify-admin-seed.js)

改造动作：

- 替换数据访问依赖
- 保持校验口径不变

优先级：

- P1

#### J4 [backend/scripts/verify-group-rules.js](/Users/yun/lindong/backend/scripts/verify-group-rules.js)

改造动作：

- 适配新 repository
- 增加对 MySQL 幂等与唯一性场景的校验

优先级：

- P0

#### J5 [backend/scripts/verify-course-lifecycle.js](/Users/yun/lindong/backend/scripts/verify-course-lifecycle.js)

改造动作：

- 主要可保留
- 仅需确保对 `courseLifecycle` 导出接口兼容

优先级：

- P2

#### J6 [backend/tests/console-api.smoke.test.js](/Users/yun/lindong/backend/tests/console-api.smoke.test.js)

改造动作：

- 保留测试框架与 mock 结构
- 更新被 mock 的 service 边界
- 新增对上传接口、后台账号、退款回滚的关键验证

优先级：

- P1

### 5.11 可删除或归档项

#### K1 [backend/wrangler.jsonc](/Users/yun/lindong/backend/wrangler.jsonc)

处置建议：

- 迁移完成后归档或删除

#### K2 [backend/scripts/set-cloudflare-secrets.template.sh](/Users/yun/lindong/backend/scripts/set-cloudflare-secrets.template.sh)

处置建议：

- 迁移完成后归档或删除

#### K3 [backend/vercel.json](/Users/yun/lindong/backend/vercel.json)

处置建议：

- 如果不再使用 Vercel，可删除

#### K4 [backend/supabase/](/Users/yun/lindong/backend/supabase)

处置建议：

- 迁移后归档或删除

## 6. 推荐改造顺序

建议后端按以下顺序开工：

1. 新增 `config/db.js`、`config/env.js`
2. 新增 `usersRepository`、`adminUsersRepository`、`adminLogRepository`
3. 改 `miniProgramAuth`、`authService`、`accountService`
4. 新增 `coursesRepository`、`groupsRepository`、`groupMembersRepository`、`ordersRepository`
5. 改 `groupOrders`、`paymentShell`、`courseLifecycle`
6. 改路由层 `orders`、`payments`、`courses`、`groups`、`user`
7. 改后台 `coursesService`、`ordersService`、`groupsService`、`dashboardService`
8. 改上传服务
9. 改脚本与测试
10. 移除 Supabase 与 Cloudflare 残留

## 7. 分工建议

### 后端负责人 A

负责：

- `config/`
- `repositories/`
- 小程序主链路 service
- 支付链路
- 定时任务

### 后端负责人 B

负责：

- `console-api/services/*`
- `utils/adminStore.js` 拆分
- 后台上传
- 后台统计与日志

### 测试负责人

负责：

- smoke test 更新
- 种子脚本验证
- 小程序与后台主链路回归

## 8. 完成定义

后端改造完成的标准建议为：

- `backend/` 主路径不再依赖 Supabase SDK
- 核心业务逻辑文件不再直接调用 `.from(...)`
- 小程序登录、课程、下单、支付、我的拼团全部通过
- 后台登录、课程、拼团、订单、账号、日志、上传全部通过
- 定时任务只在 CloudBase 路径执行
- 关键回归脚本可在 MySQL 环境下跑通

## 9. 建议结论

对当前仓库来说，最好的后端改造方式不是“把所有文件一起重写”，而是：

- 先新增基础设施层
- 再按聚合域替换数据库访问
- 最后回收旧依赖

这样既能控制风险，也最适合当前这套已经跑通业务的小程序和后台共用后端结构。
