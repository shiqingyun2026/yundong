# 2026-04-15 CloudBase + MySQL 迁移设计文档

## 1. 文档目标

本文档用于明确“邻动”项目从当前 `Supabase + Node/Express + Cloudflare Worker/微信云托管混合部署`，迁移到 `腾讯云 CloudBase + MySQL` 目标架构的设计方案。

本文档聚焦：

- 现状架构与约束
- 目标架构
- 模块级迁移设计
- 数据迁移设计
- 环境与发布设计
- 风险、回滚与验收口径

本文档不直接替代执行计划。执行拆解见：

- [2026-04-15-cloudbase-mysql-migration-tasks.md](/Users/yun/lindong/docs/deploy/2026-04-15-cloudbase-mysql-migration-tasks.md)

## 2. 背景与目标

### 2.1 当前现状

当前项目后端由以下几部分组成：

- 小程序 API：Node.js 服务，已支持微信云托管入口
- 运营后台 API：Node.js 服务
- 定时任务：Node `setInterval` 与 Cloudflare Worker `scheduled()` 并存
- 数据库：Supabase PostgreSQL
- 对象存储：Supabase Storage
- 小程序访问方式：`wx.request` 与 `wx.cloud.callContainer` 已兼容

关键代码入口：

- [backend/app.js](/Users/yun/lindong/backend/app.js)
- [backend/server.js](/Users/yun/lindong/backend/server.js)
- [backend/miniprogram-container/app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
- [backend/miniprogram-container/server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
- [backend/worker.mjs](/Users/yun/lindong/backend/worker.mjs)
- [miniprogram/app.js](/Users/yun/lindong/miniprogram/app.js)
- [miniprogram/utils/request.js](/Users/yun/lindong/miniprogram/utils/request.js)

### 2.2 迁移动机

迁移到 CloudBase + MySQL 的主要动机：

- 统一到腾讯云生态，降低跨云运维和配置复杂度
- 让小程序前台链路长期收敛到 `wx.cloud.callContainer`
- 让数据库保持关系型模型，避免文档库重构成本
- 逐步移除 Supabase、Cloudflare Worker 这类外部依赖
- 为后续正式环境、支付回调、通知投递、对象存储建立单云闭环

### 2.3 迁移目标

目标不是重写业务，而是迁移基础设施与数据访问层：

- 保留现有业务模型与 API 语义
- 保留 JWT 鉴权模型
- 保留当前表结构对应的关系型设计
- 小程序继续优先走 `callContainer`
- 运营后台继续走标准 HTTP API
- 定时任务统一迁移到 CloudBase 体系

## 3. 范围

### 3.1 本次迁移包含

- 后端 API 服务迁移到 CloudBase 云托管
- 数据库迁移到 CloudBase MySQL 型数据库
- 定时任务迁移到 CloudBase 定时触发器/云函数
- 对象存储迁移到 CloudBase 存储或 COS
- 小程序环境切到 CloudBase 统一链路
- 运营后台 API 指向新服务

### 3.2 本次迁移不包含

- 小程序页面交互重构
- 运营后台前端 UI 重构
- 拼团、支付、退款规则重写
- 账号体系从 JWT 改造成 CloudBase Auth 原生方案
- 把现有关系型模型重写成文档型数据库模型

## 4. 当前架构分析

### 4.1 运行时形态

当前后端是多入口并存：

- 综合后端：`node server.js`
- 小程序专用容器后端：`node miniprogram-container/server.js`
- 后台专用服务：`node console-api/server.js`
- Cloudflare Worker：`worker.mjs`

参考：

- [backend/package.json](/Users/yun/lindong/backend/package.json)
- [backend/Dockerfile](/Users/yun/lindong/backend/Dockerfile)

### 4.2 数据层特点

当前数据库依赖明确是关系型设计，而不是轻量 KV/文档型设计。

已观察到的关键能力依赖：

- 外键
- 唯一索引
- 条件唯一索引
- 时间字段与状态字段组合查询
- 审计日志表
- 支付流水表
- JSON 负载字段

典型迁移脚本参考：

- [20260325_admin_console.sql](/Users/yun/lindong/backend/migrations/20260325_admin_console.sql)
- [20260329_pending_order_guard.sql](/Users/yun/lindong/backend/migrations/20260329_pending_order_guard.sql)
- [20260401_payment_records.sql](/Users/yun/lindong/backend/migrations/20260401_payment_records.sql)
- [20260401_group_result_subscriptions.sql](/Users/yun/lindong/backend/migrations/20260401_group_result_subscriptions.sql)
- [20260401_group_result_notification_jobs.sql](/Users/yun/lindong/backend/migrations/20260401_group_result_notification_jobs.sql)

### 4.3 数据访问层特点

当前数据访问层没有经过仓储层抽象，代码直接耦合 Supabase SDK。

参考：

- [backend/utils/supabase.js](/Users/yun/lindong/backend/utils/supabase.js)

表现为：

- 业务代码直接调用 `.from(...).select()/insert()/update()`
- 查询风格和返回结构依赖 Supabase/PostgREST
- 存储上传签名逻辑直接依赖 Supabase Storage

这意味着迁移的主要工作量在“数据访问层替换”，而不是“业务模型重做”。

### 4.4 小程序链路现状

小程序已经具备 CloudBase 云托管接入基础：

- [miniprogram/app.js](/Users/yun/lindong/miniprogram/app.js)
- [miniprogram/utils/request.js](/Users/yun/lindong/miniprogram/utils/request.js)
- [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)

当前已经支持：

- `wx.cloud.init`
- `wx.cloud.callContainer`
- `develop/trial/release` 环境配置服务名

这使得小程序链路迁到 CloudBase 的成本相对较低。

## 5. 目标架构

### 5.1 总体架构

```text
┌──────────────────┐
│   微信小程序      │
│ wx.cloud.callContainer
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ CloudBase 云托管服务      │
│ lindong-api / lindong-admin-api
└────────┬─────────────────┘
         │
         ├───────────────┐
         │               │
         ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│ CloudBase MySQL  │  │ CloudBase 存储/COS │
└──────────────────┘  └──────────────────┘
         ▲
         │
┌──────────────────────────┐
│ 定时触发器 / 云函数       │
│ 生命周期同步 / 通知投递    │
└──────────────────────────┘
```

### 5.2 目标服务划分

建议迁移后保留两个逻辑服务入口：

- `lindong-api`
  - 面向小程序
  - 通过 `wx.cloud.callContainer`
- `lindong-admin-api`
  - 面向运营后台
  - 通过标准 HTTPS 域名访问

也可以在第一阶段先保留单服务，再按流量与权限隔离情况拆分。

### 5.3 目标原则

- 关系型数据库设计不重做
- API 出参与业务错误口径尽量不变
- 小程序优先内网链路
- 后台维持标准 Web 访问
- 配置、密钥、定时任务统一收敛到 CloudBase

## 6. 模块迁移设计

### 6.1 API 服务迁移

目标是把现有 Node 服务迁到 CloudBase 云托管，而不是把 Express 迁成别的框架。

理由：

- 现有代码已经能在容器环境运行
- [backend/Dockerfile](/Users/yun/lindong/backend/Dockerfile) 已验证容器部署路径
- 迁到 CloudBase 云托管不需要先改 HTTP 框架

建议动作：

- 继续使用 Node.js 20 容器
- 复用现有 `app.js` / `miniprogram-container/app.js`
- 新增适配 CloudBase 环境变量的配置层
- 将运行时配置与服务拆分做标准化

### 6.2 数据访问层迁移

这是本次迁移的核心改造面。

目标：

- 用 MySQL 驱动或 ORM 替代 Supabase SDK
- 将直接写在业务代码里的查询逐步下沉为 repository/service

建议分层：

- `config/db.js`：MySQL 连接池
- `repositories/*`：按表/聚合封装查询
- `services/*`：保留业务逻辑

建议优先迁移顺序：

1. `users`
2. `courses`
3. `groups`
4. `group_members`
5. `orders`
6. `payment_records`
7. `admin_users`
8. `admin_log`
9. `group_result_subscriptions`
10. `group_result_notification_jobs`

### 6.3 数据模型映射设计

#### 6.3.1 PostgreSQL 到 MySQL 的主要映射

- `uuid`
  - 保留字符串 UUID 语义
  - MySQL 可用 `char(36)` 或 `varchar(36)`
- `timestamptz`
  - 迁到 `datetime` 或 `timestamp`
  - 统一应用层按 UTC 存储
- `jsonb`
  - 迁到 MySQL `json`
- `inet`
  - 迁到 `varchar(45)`
- `bigserial`
  - 迁到 `bigint auto_increment`
- `numeric(10,6)`
  - 迁到 `decimal(10,6)`

#### 6.3.2 特殊注意事项

- PostgreSQL 的条件唯一索引需要确认 MySQL 实现方式
- `check constraint` 在 MySQL 上更多依赖应用层兜底校验
- `timezone('utc', now())` 这类默认值写法需要重写
- `on conflict` 风格 upsert 需要改为 MySQL upsert 语法

### 6.4 鉴权迁移

建议本次迁移中继续保留现有 JWT 体系，不引入 CloudBase 原生登录改造。

理由：

- 当前用户与管理员鉴权已稳定
- 迁移重点应放在基础设施和数据访问层
- 同时改认证体系会显著放大回归面

保留方式：

- 小程序登录仍走 `code -> openid -> users -> 自签 JWT`
- 后台登录仍走 `admin_users + password_hash + JWT`
- 中间件接口不变，内部只替换数据库查询实现

相关代码：

- [backend/shared/services/miniProgramAuth.js](/Users/yun/lindong/backend/shared/services/miniProgramAuth.js)
- [backend/middleware/auth.js](/Users/yun/lindong/backend/middleware/auth.js)
- [backend/middleware/adminAuth.js](/Users/yun/lindong/backend/middleware/adminAuth.js)

### 6.5 小程序接入迁移

小程序目标保持：

- `develop/trial/release` 都优先走 `container`
- 服务名指向 CloudBase 云托管服务

建议改动：

- `VITE` 或 HTTP 外链仅作为调试兜底
- 正式环境统一 `cloudEnv + serviceName`
- 将 `ENV_API_BASE_URLS` 从 Cloudflare 域名切换为后台 HTTP 域名，仅作为兜底或后台用途

相关文件：

- [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)

### 6.6 运营后台接入迁移

后台前端继续走标准 HTTP API，不走 `callContainer`。

建议：

- 新增 CloudBase 云托管或 API 网关公开域名
- `console` 前端环境变量切到新域名
- 后台上传 API 同步迁移

相关文件：

- [console/.env.example](/Users/yun/lindong/console/.env.example)
- [console/src/lib/api.ts](/Users/yun/lindong/console/src/lib/api.ts)

### 6.7 对象存储迁移

当前后台上传直接依赖 Supabase Storage 签名上传。

参考：

- [backend/console-api/services/uploadService.js](/Users/yun/lindong/backend/console-api/services/uploadService.js)

目标方案建议二选一：

#### 方案 A：服务端代理上传

优点：

- 改造简单
- 不依赖控制台用户接入 CloudBase 身份

缺点：

- 增加服务带宽与 CPU 负担

#### 方案 B：服务端下发临时凭证，前端直传 COS/CloudBase 存储

优点：

- 更贴近现在的签名上传模式
- 上传性能更好

缺点：

- 实现复杂度更高

建议：

- 第一阶段采用服务端代理上传
- 第二阶段若运营后台上传量变大，再改成临时凭证直传

### 6.8 定时任务迁移

当前有两套定时逻辑：

- [backend/server.js](/Users/yun/lindong/backend/server.js) 中的 `setInterval`
- [backend/worker.mjs](/Users/yun/lindong/backend/worker.mjs) 中的 `scheduled()`

目标：

- 统一为 CloudBase 定时触发器
- 仅保留一个执行源

建议实现：

- 用 CloudBase 定时触发器触发云函数
- 云函数调用受保护内部接口，或直接复用 service 层
- 统一承接：
  - 课程生命周期同步
  - 拼团结果通知投递

### 6.9 支付与通知迁移

支付与通知逻辑不重写，只迁基础环境：

- 微信支付回调域名切到 CloudBase 对外域名
- 云托管环境补齐支付与通知变量
- 通知任务仍按现有任务表与投递逻辑执行

相关文件：

- [backend/routes/payments.js](/Users/yun/lindong/backend/routes/payments.js)
- [backend/shared/services/paymentShell.js](/Users/yun/lindong/backend/shared/services/paymentShell.js)
- [backend/shared/services/groupResultNotificationDelivery.js](/Users/yun/lindong/backend/shared/services/groupResultNotificationDelivery.js)

## 7. 数据迁移设计

### 7.1 总体策略

建议采用：

- 先建新库
- 再做结构迁移
- 再做全量数据迁移
- 再做双写或短冻结切换
- 最后切只读并完成最终校验

不建议：

- 先切 API 再慢慢补数据
- 在没有完整校验前直接切正式环境

### 7.2 表级迁移顺序

建议顺序：

1. `users`
2. `admin_users`
3. `courses`
4. `groups`
5. `group_members`
6. `orders`
7. `payment_records`
8. `group_result_subscriptions`
9. `group_result_notification_jobs`
10. `admin_log`

说明：

- 先迁主实体
- 再迁关系表
- 再迁流水与日志

### 7.3 字段兼容要求

- 主键值保持不变
- `openid` 保持不变
- `order_no` / `transaction_id` / `out_trade_no` 保持不变
- 时间字段统一按 UTC 存储
- JSON 字段迁移后结构不变

### 7.4 索引与约束策略

迁移时必须保留：

- 订单唯一性约束
- 支付记录唯一约束
- 管理员用户名/邮箱唯一约束
- 通知任务唯一约束

其中最需要提前验证的是：

- `orders_user_course_pending_unique_idx`

如果 MySQL 无法原样表达条件唯一索引，则需设计替代方案，例如：

- 新增应用层幂等保护
- 增加辅助状态字段
- 在创建 pending 订单前强制事务清理旧记录

### 7.5 数据一致性校验

切换前后必须做结构化对账：

- 用户数
- 课程数
- 拼团数
- 团成员数
- 订单数
- 已支付订单数
- 已退款订单数
- 支付记录数
- 后台账号数
- 通知订阅数
- 通知任务数

并对关键业务样本做逐条抽检：

- 进行中课程
- 已成团课程
- 已失败退款课程
- 待支付订单
- 成功支付订单
- 手动退款订单

## 8. 环境与配置设计

### 8.1 CloudBase 资源规划

建议至少规划以下资源：

- 云托管服务：
  - `lindong-api`
  - `lindong-admin-api` 或单体 `lindong-backend`
- MySQL 数据库实例
- 对象存储桶
- 云函数：
  - 定时同步
  - 地理位置云函数
- 自定义域名：
  - 小程序 API 对外域名
  - 后台 API 域名

### 8.2 环境变量规划

建议重新分组：

- 基础配置
  - `PORT`
  - `NODE_ENV`
  - `JWT_SECRET`
- 数据库配置
  - `MYSQL_HOST`
  - `MYSQL_PORT`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`
- 存储配置
  - `COS_BUCKET`
  - `COS_REGION`
  - `COS_SECRET_ID`
  - `COS_SECRET_KEY`
- 微信登录/支付配置
  - `WX_MINIPROGRAM_APP_ID`
  - `WX_MINIPROGRAM_APP_SECRET`
  - `WX_PAY_MCH_ID`
  - `WX_PAY_MCH_SERIAL_NO`
  - `WX_PAY_PRIVATE_KEY`
  - `WX_PAY_PLATFORM_CERT`
  - `WX_PAY_API_V3_KEY`
  - `WX_PAY_NOTIFY_URL`
- 定时任务与内部接口
  - `CRON_SECRET`
  - `GROUP_RESULT_NOTIFICATION_BATCH_SIZE`
  - `GROUP_RESULT_NOTIFICATION_DELIVERY_MODE`

### 8.3 环境分层

建议保留：

- `develop`
- `trial`
- `release`

要求：

- 三套环境拥有独立数据库或最少独立 schema/实例
- 小程序配置、支付配置、通知模板、回调地址严格分环境

## 9. 发布与切换设计

### 9.1 发布顺序

建议顺序：

1. 建 CloudBase 资源
2. 部署 API 服务到测试环境
3. 建 MySQL 结构并迁测试数据
4. 回归小程序和后台
5. 迁正式数据并核验
6. 切小程序环境
7. 切后台 API 域名
8. 切支付回调
9. 关闭旧定时任务

### 9.2 切换原则

- 切换窗口内冻结后台写操作
- 支付回调切换前必须完成回调联调
- 定时任务只允许一边在跑
- 切换后保留旧库只读观察期

## 10. 风险与应对

### 10.1 高风险项

- Supabase SDK 查询重写不完整，导致业务回归
- 条件唯一索引迁移不等价，导致 pending 订单重复
- 上传链路替换后后台课程图片异常
- 定时任务双跑导致重复退款或重复通知
- 支付回调域名切换遗漏，导致支付成功不到账

### 10.2 风险应对

- 所有查询迁移后补 smoke 与业务回归
- 对“创建订单、支付成功、退款、通知”做专项回归
- 切换前演练一次全链路灰度
- 设置旧库只读与快速回退域名方案

## 11. 回滚设计

回滚目标是“快速恢复旧链路”，不是“在新旧环境间来回同步”。

建议保留：

- 旧 Supabase 数据库只读可用
- 旧后端服务镜像与配置
- 旧支付回调地址可恢复
- 小程序旧环境配置可快速回切
- 后台 `VITE_API_BASE_URL` 可快速切回旧地址

触发回滚的条件建议包括：

- 支付成功后订单无法入账
- 订单创建出现大面积重复或失败
- 课程、拼团、我的订单等主链路出现核心故障
- 上传能力不可用且影响后台运营

## 12. 验收标准

### 12.1 小程序验收

- 登录成功
- 首页课程可读
- 课程详情可读
- 创建订单成功
- 拉起支付成功
- 支付回调成功入账
- 我的拼团展示正确
- 拼团结果通知链路可跑通

### 12.2 后台验收

- 管理员登录成功
- 课程列表、详情、创建、编辑、下架正常
- 拼团列表、详情、异常提示正常
- 订单列表、详情、手动退款正常
- 账号管理正常
- 操作日志可查
- 图片上传正常

### 12.3 数据验收

- 核心表行数对齐
- 核心订单状态对齐
- 支付记录对齐
- 通知任务与订阅数据对齐
- 无关键约束缺失导致的数据污染

## 13. 推荐结论

对当前仓库而言，“迁到 CloudBase + MySQL”是推荐方案，前提是明确以下边界：

- 这是一次基础设施与数据访问层迁移
- 不是一次业务模型重写
- 不是一次认证体系重做

最稳妥的执行策略是：

- 先迁 API 运行面到 CloudBase
- 再迁 MySQL 数据层
- 再切存储和定时任务
- 最后完成正式流量切换

这样可以最大限度复用现有业务代码和小程序 `callContainer` 基础，避免把迁移复杂度放大成一次全面重构。
