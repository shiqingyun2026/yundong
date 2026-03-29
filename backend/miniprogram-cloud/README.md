# miniprogram-cloud

`miniprogram-cloud/` 是小程序迁微信云开发时的接入层骨架。

当前约束：

- 现网默认仍走 HTTP，不直接切到云函数
- 云函数接入层只负责身份、入参、出参适配
- 课程、拼团、订单、支付规则继续复用 `backend/shared/`
- 主数据仍然只认现有主库，不在云开发侧另起一套主数据

当前目录说明：

- `functions/miniProgramGateway/index.js`
  - 云函数统一入口
  - 接收 `{ path, method, data, header, authToken }`
- `app/routeRegistry.js`
  - 记录计划迁移的路由和来源文件
  - 先覆盖读接口，再覆盖写接口
- `adapters/requestContext.js`
  - 把 `wx.cloud.callFunction` 的事件结构归一化
- `adapters/responses.js`
  - 统一云函数返回结构，保持和现有小程序请求层兼容

当前计划优先级：

1. `GET /api/courses` (已接真实实现)
2. `GET /api/courses/:id` (已接真实实现)
3. `GET /api/courses/:id/active-group` (已接真实实现)
4. `GET /api/groups/:id` (已接真实实现)
5. `GET /api/user/groups` (已接真实实现)
6. `POST /api/auth/login` (已接真实实现)
7. `POST /api/orders` (已接真实实现)
8. `POST /api/payments/mock-success` (已接真实实现)

接下来落真实实现时，建议顺序：

1. 当前这 8 条已接入路由已经直接调用 `backend/shared/*`，不再转调 HTTP
2. 后续新增小程序云函数能力时，继续优先复用 `backend/shared/*`，不要把规则写回接入层
3. 真实切流前，先补齐云环境参数、部署云函数，再让小程序开发环境切到 `cloud`

当前本地验证：

- `cd /Users/yun/lindong/backend && npm run verify:miniprogram-cloud-smoke`
  - 当前覆盖 `miniProgramGateway` 的路由匹配、请求归一化、上下文透传、404 包裹、以及服务错误包裹
