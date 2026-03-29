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

1. 先把 `backend/routes/courses.js` 与 `backend/routes/groups.js` 中仍在入口层的查询逻辑继续下沉到共享读服务
2. 再让云函数入口直接调用共享读服务，而不是去转调 HTTP
3. 读链路稳定后，再迁登录、下单、支付等写链路
