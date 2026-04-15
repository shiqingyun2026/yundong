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
- 仍待在真实环境完成连接验证

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
- 已完成首批真实实现：
  - `usersRepository`
  - `adminUsersRepository`
  - `adminLogRepository`
- 其他 repository 仍为占位实现

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
- 仍待完成：
  - `USE_MYSQL_REPOSITORIES=true` 环境下联调
  - `console-api` 登录与账号接口实测

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
- 已补齐课程生命周期在 MySQL 模式下的状态计算与自动退款分支，避免创建订单前校验仍回落到 Supabase
- 仍待完成：
  - 真 MySQL 数据库联调
  - 小程序真机从课程详情进入支付确认页的完整回归
  - 支付成功后“我的拼团”列表页专项验证

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
- 已支持小程序支付准备在 MySQL 模式下生成/更新 `payment_records`
- 仍待完成：
  - 通知任务消费链路切到 MySQL repository
  - 微信支付真实回调联调
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
