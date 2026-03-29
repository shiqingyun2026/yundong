# 小程序微信云开发 / Console 标准服务端 交接文档

更新时间：2026-03-29

## 1. 背景与目标

当前项目的目标不是继续让小程序端和运营后台长期共用一套 `backend/routes` 入口，而是拆成两种运行形态：

- 小程序端：迁到微信云开发接入层
- Console 运营后台：继续走标准 HTTP 服务端
- 两端：继续共用同一套业务规则和同一套核心数据

核心原则不变：

1. 不允许小程序云开发和 console 后台各写一套业务规则。
2. 不允许两边各维护一份主数据。
3. 共享的应该是规则和数据，不是部署容器。


## 2. 当前结论

截至 2026-03-29，仓库已经从“只有目标设计”推进到“核心骨架已落地”的阶段：

1. `backend/shared/` 已经建立，并接住了小程序与后台的关键共享规则。
2. `backend/migrations/20260329_pending_order_guard.sql` 已经落库，不再只是待执行状态。
3. `backend/miniprogram-cloud/` 已经落下接入层骨架，且云函数入口已经接上当前 8 个小程序相关接口。
4. `backend/console-api/` 已经落下独立后台服务骨架，后台所有 admin 路由实现已迁到 `console-api/routes/*`。
5. 旧的 `backend/routes/admin/*` 现在是兼容壳，真实实现归属已经切到 `backend/console-api/routes/*`。


## 3. 当前已完成的工作

### 3.1 共享业务层

已经落地的共享层：

- `backend/shared/domain/groupRules.js`
- `backend/shared/services/groupOrders.js`
- `backend/shared/services/courseReaders.js`
- `backend/shared/services/groupReaders.js`
- `backend/shared/services/miniProgramAuth.js`
- `backend/shared/presenters/courseView.js`
- `backend/shared/presenters/groupView.js`
- `backend/shared/utils/formatters.js`
- `backend/shared/utils/auth.js`

已经接入共享层的入口：

- 小程序写链路：`backend/routes/orders.js`、`backend/routes/payments.js`
- 小程序读链路：`backend/routes/courses.js`、`backend/routes/groups.js`、`backend/routes/user.js`
- 小程序登录：`backend/routes/auth.js`

已确认的规则收口结果：

- 创建新订单前会关闭同用户同课程的旧 `pending` 订单
- 过期但仍是 `active` 的脏团会先被清成 `failed`
- 脏团上的 `pending` 订单会关闭成 `closed`
- 脏团上的 `success` 订单不会在清理阶段被误改
- 支付成功时仅首次入团增加人数
- 后台手动退款会回滚成员关系、团人数和团状态

### 3.2 数据库约束

已经完成：

- `backend/migrations/20260329_pending_order_guard.sql` 已经执行到主库
- `orders_user_course_pending_unique_idx` 已存在

当前效果：

- 每个用户同一课程最多保留一笔 `pending` 订单
- 并发下单规则不再只停留在应用层

### 3.3 小程序微信云开发接入层

已经落地的目录：

- `backend/miniprogram-cloud/functions/miniProgramGateway/index.js`
- `backend/miniprogram-cloud/app/routeRegistry.js`
- `backend/miniprogram-cloud/app/handlers/`
- `backend/miniprogram-cloud/adapters/`
- `backend/miniprogram-cloud/README.md`

当前已接入云函数入口的接口：

- `GET /api/courses`
- `GET /api/courses/:id`
- `GET /api/courses/:id/active-group`
- `GET /api/groups/:id`
- `GET /api/user/groups`
- `POST /api/auth/login`
- `POST /api/orders`
- `POST /api/payments/mock-success`

小程序侧已经完成的配套：

- `miniprogram/utils/request.js` 已支持 `http` / `cloud` 双 transport
- `miniprogram/config/env.js` 已支持按环境切换 transport、云函数名、云环境
- `miniprogram/app.js` 已支持云开发初始化

当前默认行为：

- 仍默认走 HTTP
- 还没有切到真实云环境
- 这样做是为了先保证接入层落地，不影响现网

### 3.4 Console 独立服务入口

已经落地的目录：

- `backend/console-api/app.js`
- `backend/console-api/server.js`
- `backend/console-api/routes/index.js`
- `backend/console-api/routes/_helpers.js`
- `backend/console-api/routes/auth.js`
- `backend/console-api/routes/dashboard.js`
- `backend/console-api/routes/logs.js`
- `backend/console-api/routes/upload.js`
- `backend/console-api/routes/accounts.js`
- `backend/console-api/routes/orders.js`
- `backend/console-api/routes/groups.js`
- `backend/console-api/routes/courses.js`
- `backend/console-api/README.md`

当前后台入口状态：

- 综合后端 `backend/app.js` 已改为挂载 `backend/console-api/routes`
- 旧的 `backend/routes/admin/*` 已全部退化为兼容壳
- 已新增 `npm run console:start` / `npm run console:dev`


## 4. 当前目录落点

当前推荐直接认下面这个结构：

```text
backend/
  shared/
    domain/
    presenters/
    services/
    constants/
    utils/
  miniprogram-cloud/
    adapters/
    app/
    functions/
  console-api/
    routes/
    app.js
    server.js
```

与旧目录的关系：

- `backend/routes/admin/*` 还在，但仅用于兼容旧引用
- 后续新开发应优先写到 `backend/console-api/*`
- 小程序新增云函数能力应优先写到 `backend/miniprogram-cloud/*`


## 5. 当前运行方式

综合后端：

- `cd backend`
- `npm run dev`

独立 console 服务：

- `cd backend`
- `npm run console:dev`

当前注意：

- `console-api/server.js` 默认不启动课程生命周期定时同步
- 避免和综合后端重复执行同一批定时状态同步
- 如果未来 console 服务要独立长期运行，再决定是否开启 `CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC=true`


## 6. 已验证项

已完成的验证：

- `npm run verify:group-rules` 通过
- `npm run verify:console-api-smoke` 通过
- `npm run verify:miniprogram-cloud-smoke` 通过
- `npm run verify:admin-seed` 通过
- 独立 `console-api@8100` + console 前端真实登录与 dashboard 本地联调通过
- `cd qa/regression && npm run test:console-live` 通过
- `test:console-live` 当前已覆盖真实登录、dashboard、courses、orders(含详情)、accounts、logs、课程/账号筛选，以及可回滚的账号状态编辑与 `account_update` 日志校验
- 小程序云函数读接口真连库 smoke test 通过
- 云函数登录入口可返回 token
- 云函数未授权访问写接口会返回 `401`
- `console-api` 独立 app、综合后端 app、admin 兼容壳均可正常加载
- `backend/migrations/20260329_pending_order_guard.sql` 已确认落库
- `docs/sql/reset_test_seed_0326.sql` 已重新导入，当前测试库已回到 0326 seed 基线


## 7. 当前仍未完成的部分

### 7.1 小程序云开发还没真正切流

虽然 `miniprogram-cloud/` 和 transport 已经落地，但当前还没做下面几件事：

- 没有填真实 `ENV_CLOUD_ENVS`
- 没有部署真实微信云函数环境
- 小程序默认 transport 仍是 `http`
- 但本地已新增 `verify:miniprogram-cloud-smoke`，可以先验证云函数网关骨架与路由包裹
- 已新增 [cloud-cutover-checklist.md](/Users/yun/lindong/docs/miniprogram/cloud-cutover-checklist.md) 用于整理开发环境切到 `cloud` 前的执行步骤

### 7.2 Console 还没有完成第二阶段拆分

当前已经从“只有独立入口”推进到“现有 console-api 路由均已做第二阶段拆分”，但还没完成：

- `auth`、`accounts`、`logs`、`upload`、`courses`、`groups`、`orders`、`dashboard` 已拆成 `routes -> controllers -> services`
- `middleware/` 拆分
- 删除 `backend/routes/admin/*` 兼容壳

### 7.3 部署层还没彻底分离

当前仓库里已经能分别运行综合后端和独立 console 服务，但还没完成：

- 真实部署环境拆分
- console 前端与独立 console-api 服务更大范围的正式联调
- 小程序切到云开发后的正式联调


## 8. 已知风险与注意事项

### 8.1 不能改成双主数据

这一条仍然是最高优先级：

- 不要让微信云开发数据库和现有主库长期并存并双写
- 当前应继续以现有主库为唯一事实来源

### 8.2 不能在云函数里重复造规则

云函数层现在已经有入口，但后续继续开发时要保持：

- 云函数只做身份、入参、出参适配
- 业务判断继续走 `backend/shared/*`

### 8.3 兼容壳还在

`backend/routes/admin/*` 现在仍然存在，目的是兼容旧引用。

含义是：

- 新逻辑不要再往旧目录堆
- 旧目录后续应只继续缩，不应再长


## 9. 推荐接手顺序

按当前状态，建议接手者继续按下面顺序推进：

1. 先把微信云环境参数补齐，并部署 `backend/miniprogram-cloud/functions/miniProgramGateway`
2. 小程序端先在开发环境把 transport 切到 `cloud`，完成读链路联调
3. 再联调小程序登录、下单、模拟支付成功
4. console 侧继续把通用校验、表能力检查、异常处理往 `middleware/` 和公共模块收口
5. 等 console 前端稳定后，再删除 `backend/routes/admin/*` 兼容壳


## 10. 一句话总结

这次交接的关键，不是“文档里建议以后怎么拆”，而是：

**仓库已经从“共享一套 backend/routes”推进到“shared / miniprogram-cloud / console-api 三层都已落地”，接下来主要是切流、联调和去兼容壳。**
