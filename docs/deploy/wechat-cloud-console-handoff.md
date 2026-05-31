# 小程序微信云托管 / Console 标准服务端 交接文档

更新时间：2026-04-19

## 1. 当前最终架构

当前项目已经明确收口为三条入口：

- 小程序：`wx.cloud.callContainer -> 云托管服务 lindong-api`
- Console 前端：CloudBase 静态托管
- Console 接口：CloudBase 云托管 `lindong-console-api`
- 两端：继续共用 `backend/shared/*` 里的业务规则和同一套主数据

这次收口后，不再继续维护“小程序 -> 云函数 -> 外部 HTTP”的试错路径。

## 2. 当前已经完成的工作

### 2.1 共享业务层

共享规则与查询层继续放在：

- [groupRules.js](/Users/yun/lindong/backend/shared/domain/groupRules.js)
- [groupOrders.js](/Users/yun/lindong/backend/shared/services/groupOrders.js)
- [courseReaders.js](/Users/yun/lindong/backend/shared/services/courseReaders.js)
- [groupReaders.js](/Users/yun/lindong/backend/shared/services/groupReaders.js)
- [miniProgramAuth.js](/Users/yun/lindong/backend/shared/services/miniProgramAuth.js)

### 2.2 小程序云托管入口

当前已经落地并启用：

- [app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
- [server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
- [Dockerfile](/Users/yun/lindong/backend/Dockerfile)
- [.dockerignore](/Users/yun/lindong/backend/.dockerignore)

小程序侧已经同步切到：

- [env.js](/Users/yun/lindong/miniprogram/config/env.js)
- [app.js](/Users/yun/lindong/miniprogram/app.js)
- [request.js](/Users/yun/lindong/miniprogram/utils/request.js)

### 2.3 Console 独立服务入口

当前保持不变：

- [app.js](/Users/yun/lindong/backend/console-api/app.js)
- [server.js](/Users/yun/lindong/backend/console-api/server.js)
- [routes](/Users/yun/lindong/backend/console-api/routes)

### 2.4 Console 后端云托管部署包

当前建议将后台接口部署到独立 CloudBase 云托管服务：

- 部署目录：
  - [backend/console-api-service](/Users/yun/lindong/backend/console-api-service)
- 建议服务名：
  - `lindong-console-api`
- 发布说明：
  - [console-cloudbase-cutover.md](/Users/yun/lindong/docs/deploy/console-cloudbase-cutover.md)

### 2.5 Console 前端静态托管

当前建议将后台前端统一发布到 CloudBase 静态托管：

- 源码目录：
  - [console](/Users/yun/lindong/console)
- 构建产物：
  - [console/dist](/Users/yun/lindong/console/dist)
- 发布说明：
  - [console-cloudbase-hosting.md](/Users/yun/lindong/docs/deploy/console-cloudbase-hosting.md)

## 3. 当前验证基线

截至 2026-04-18，已通过：

- `npm run verify:group-rules`
- `npm run verify:console-api-smoke`
- `npm run verify:admin-seed`
- `cd qa/regression && npm run test:console-live`
- 小程序服务级真实 API 验证
- 小程序页面级真实联调：
  - 首页读链路通过
  - 课程详情通过
  - 登录通过
  - 创建订单通过
  - mock 支付成功通过
  - “我的拼团”同步通过
  - 真实 CloudBase + MySQL 环境下课程列表通过
  - 真实 CloudBase + MySQL 环境下课程详情通过
  - 真实 CloudBase + MySQL 环境下“立即开团 -> 支付准备 -> 模拟支付成功”通过
  - 真实 CloudBase + MySQL 环境下“我的拼团”通过
  - 通过 SQL 兜底补第二成员后，课程详情页与团状态已同步显示“已成团”

## 4. 2026-04-18 真实环境最新状态

### 4.1 当前真实环境配置

- 微信小程序真实 AppID：
  - `wxf18a9c72d851ef7a`
- CloudBase 环境 ID：
  - `tttiyubao-4g141829bdf6a28d`
- 云托管服务名：
  - `lindong-api`
- 小程序 `develop / trial / release` 当前都已指向：
  - `container`
  - `tttiyubao-4g141829bdf6a28d`
  - `lindong-api`

对应文件：

- [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)
- [project.config.json](/Users/yun/lindong/project.config.json)
- [miniprogram/project.config.json](/Users/yun/lindong/miniprogram/project.config.json)

### 4.2 当前真实环境部署方式

CloudBase 当前应直接使用独立后端服务目录，而不是再维护手工 deploy artifact：

- [backend/lindong-api](/Users/yun/lindong/backend/lindong-api)

**这里是当前小程序后端应使用的正式部署目录。**

- 真机、小程序云托管、CloudBase 控制台实际应部署这个目录里的代码
- 不要再直接把混合 `backend/` 作为部署目录
- 交接、排障、真机验证前，必须先确认 `backend/lindong-api/` 已同步到最新版本
- 这轮已经把旧 deploy artifact 迁移掉，避免“代码改了但部署目录还是旧版”的问题

Console 后端现在也建议采用完全一致的思路：

- 独立部署目录：
  - [backend/console-api-service](/Users/yun/lindong/backend/console-api-service)
- 只修改混合 `backend/console-api` 不会自动影响 CloudBase 线上
- 发布前必须同步并部署该目录

已验证：

- 如果只改混合 `backend/` 而不重新同步更新 `backend/lindong-api/`，重新部署后不会生效
- 因此当前继续排障时，凡是要重新部署到 `lindong-api` 的改动，都必须同步到正式部署目录
- 2026-04-20 课包拼团真机回归中曾再次踩到“部署包文件仍是旧版”的问题，至少出现过以下漏同步文件：
  - `repositories/ordersRepository.js`
  - `routes/user.js`
  - `routes/payments.js`
  - `shared/services/paymentShell.js`
  - `repositories/paymentRecordsRepository.js`
- 其中支付主链路最容易被旧文件卡住，真机支付前至少要核对：
  - [routes/payments.js](/Users/yun/lindong/backend/lindong-api/routes/payments.js)
  - [shared/services/paymentShell.js](/Users/yun/lindong/backend/lindong-api/shared/services/paymentShell.js)
  - [repositories/paymentRecordsRepository.js](/Users/yun/lindong/backend/lindong-api/repositories/paymentRecordsRepository.js)
  - [repositories/ordersRepository.js](/Users/yun/lindong/backend/lindong-api/repositories/ordersRepository.js)
  - [routes/user.js](/Users/yun/lindong/backend/lindong-api/routes/user.js)

### 4.2.1 首页定位链路额外提醒

首页定位和地址搜索不走 `lindong-api` 云托管服务，而是继续依赖微信云函数：

- 云函数目录：
  - [cloudfunctions/ip-geolocation](/Users/yun/lindong/cloudfunctions/ip-geolocation)
- 小程序当前配置：
  - [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)

真机如果出现“首页定位不可用 / 地址搜索失败 / 一直回落默认深圳”，优先检查下面三件事：

- `ip-geolocation` 云函数是否已经部署到当前 CloudBase 环境 `tttiyubao-4g141829bdf6a28d`
- 云函数环境变量 `TENCENT_MAP_KEY` 是否已配置
- 云开发数据库集合 `ip_location_cache` 是否已创建

这条链路和 `backend/lindong-api` 是两套独立部署物：

- 后端接口改动要同步 `backend/lindong-api`
- 首页定位 / POI 搜索改动要同步微信云函数 `cloudfunctions/ip-geolocation`

2026-04-20 已补前端兜底：

- 当 `ip-geolocation` 不可用时，首页不再静默装作成功，而会提示“地址解析暂不可用”
- 地址选择页增加“地图选点”兜底入口，即使云函数没配好也能手动切换位置继续回归

### 4.3 当前真实环境数据库初始化方式

CloudBase SQL 执行器当前兼容性较弱，不适合一次性执行复杂 DDL 或带 `INSERT ... SELECT ... ON DUPLICATE KEY UPDATE` 的组合 SQL。

这轮已经验证通过的最稳方式是拆步执行：

0. 如需先打通后台管理员登录，可先建后台管理员表并插入默认管理员：
   - [mysql_step0_admin_users.sql](/Users/yun/lindong/backend/migrations/mysql_step0_admin_users.sql)
1. 先建登录必需表：
   - [mysql_step1_users.sql](/Users/yun/lindong/backend/migrations/mysql_step1_users.sql)
2. 再建小程序主链路核心表：
   - [mysql_step2_miniprogram_core.sql](/Users/yun/lindong/backend/migrations/mysql_step2_miniprogram_core.sql)
3. 再插一门可见课程：
   - [mysql_step3_seed_visible_course.sql](/Users/yun/lindong/backend/migrations/mysql_step3_seed_visible_course.sql)
4. 如需兜底验证成团，可补第二成员并置成功团：
   - [mysql_step4_seed_second_member_success_split.sql](/Users/yun/lindong/backend/migrations/mysql_step4_seed_second_member_success_split.sql)

说明：

- [mysql_init_schema.sql](/Users/yun/lindong/backend/migrations/mysql_init_schema.sql) 仍保留作为完整版结构草案
- 但真实 CloudBase SQL 控制台里，优先使用上述分步脚本

### 4.4 当前已确认打通的真实前台主链路

在 `USE_MYSQL_REPOSITORIES=true`、CloudBase `callContainer`、真实 MySQL 环境下，已确认通过：

- 小程序登录
- 课程列表
- 课程详情
- 创建订单
- 支付准备
- mock 支付成功
- 我的拼团
- 成团状态同步到课程详情页

仍未完成：

- 第二个真实微信号的“去参团”真机链路
- 后台 `console-api` 真实 MySQL 课程、订单写链路 live smoke
- 正式微信支付、正式订阅通知联调

## 5. 今天额外沉淀

### 5.1 页面主链路回归数据已收口到回归工程

当前建议直接使用 `qa/regression/` 中维护的固定回归数据与 Playwright 用例，不再依赖独立的临时造数脚本。

### 5.2 旧云函数路线已清理

已移除：

- `cloudfunctions/`
- `backend/miniprogram-cloud/`
- `docs/miniprogram/cloud-cutover-checklist.md`
- 小程序请求层中的 `callFunction` 兼容代码
- 项目配置中的 `cloudfunctionRoot`

## 6. 当前建议直接认的目录结构

```text
backend/
  lindong-api/
  console-api-service/
  console-api/
  shared/
  miniprogram-container/
miniprogram/
  config/
  utils/
docs/
  deploy/
  miniprogram/
```

## 7. 当前仍未完成的部分

### 7.1 Console

- 还没有补课程或订单的真实写链路 live smoke
- 已完成 `console-api` 真实 MySQL 登录联调：
  - `POST /api/admin/login` 返回 `code=0` 与管理员 token
  - `GET /api/admin/accounts` 返回管理员账号列表
  - `GET /api/admin/logs` 返回登录日志
- 已修复 MySQL `DATETIME` 读取时区偏移：
  - `backend/config/db.js` 使用 `timezone: '+08:00'`
  - 操作日志页面显示时间已确认恢复为北京时间

### 7.2 部署层

- 需要继续把“源码改动 -> 同步正式服务根目录 -> CloudBase 部署”的流程沉淀得更稳定
- 线上最终发布策略还没定版

### 7.3 真支付 / 真通知

- 目前仍是 mock 支付成功验证
- 真实微信支付、回调、订阅消息模板仍待接通

## 8. 接手建议

1. 先继续做 `console-api` 的真实 MySQL 课程、订单写链路 smoke
2. 再把 `backend/lindong-api` 和 `backend/console-api-service` 的生成流程继续收口
3. 最后再推进真支付、真通知链路

## 9. 重要提醒

- 小程序如果继续排障，优先看云托管服务 `lindong-api`，不要再回到旧云函数思路
- Console 不要接入 `callContainer`
- 所有业务规则继续收口在共享层，不要在入口层重新发散
- Console 代码入口统一以 `backend/console-api/*` 为准，不再保留 `backend/routes/admin/*` 兼容壳
- 真实 CloudBase 部署当前应以 [backend/lindong-api](/Users/yun/lindong/backend/lindong-api) 与 [backend/console-api-service](/Users/yun/lindong/backend/console-api-service) 为准
- 真机验收前先核对正式部署目录版本，避免拿旧代码做回归
