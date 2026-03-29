# 2026-03-30 Console / 微信云开发 交接补充

## 1. 这轮实际推进了什么

这轮不是只停在“结构已经拆了”，而是把第二阶段和第三阶段前半段都补到了可重复验证的状态。

### 1.1 Console 第二阶段

- `backend/console-api` 现有后台路由已经全部拆成 `routes -> controllers -> services`
- `backend/middleware/adminAuth.js` 与 `backend/middleware/auth.js` 已修复 `next()` 未返回导致的异步链路问题
- `backend/tests/console-api.smoke.test.js` 已覆盖后台入口的 Node 级 smoke
- `qa/regression/tests/console.live.spec.ts` 已覆盖独立 `console-api` 的浏览器级真实联调

### 1.2 小程序云开发第三阶段准备

- `backend/miniprogram-cloud/functions/miniProgramGateway/index.js` 对当前 8 条小程序相关路由已接真实实现
- `backend/tests/miniprogram-cloud.smoke.test.js` 已新增，用于本地验证云函数网关骨架
- `miniprogram/config/env.js` 已改成显式云环境占位，不再是空字符串
- `docs/miniprogram/cloud-cutover-checklist.md` 已新增，用于整理切到 `cloud` 前的执行步骤

## 2. 当前验证基线

截至 2026-03-30，下列验证都已通过：

- `cd /Users/yun/lindong/backend && npm run verify:console-api-smoke`
- `cd /Users/yun/lindong/backend && npm run verify:miniprogram-cloud-smoke`
- `cd /Users/yun/lindong/backend && npm run verify:admin-seed`
- `cd /Users/yun/lindong/qa/regression && npm run test:console-live`

其中 `test:console-live` 当前覆盖：

- 真实登录
- `dashboard`
- `courses`
- `orders`（含详情）
- `accounts`
- `logs`
- 课程/账号筛选
- 可回滚的账号状态编辑
- `account_update` 日志落库校验

## 3. 当前关键文件

### 3.1 Console

- [app.js](/Users/yun/lindong/backend/console-api/app.js)
- [server.js](/Users/yun/lindong/backend/console-api/server.js)
- [controllers](/Users/yun/lindong/backend/console-api/controllers)
- [services](/Users/yun/lindong/backend/console-api/services)
- [console.live.spec.ts](/Users/yun/lindong/qa/regression/tests/console.live.spec.ts)
- [console-api.smoke.test.js](/Users/yun/lindong/backend/tests/console-api.smoke.test.js)

### 3.2 小程序云开发

- [miniProgramGateway/index.js](/Users/yun/lindong/backend/miniprogram-cloud/functions/miniProgramGateway/index.js)
- [routeRegistry.js](/Users/yun/lindong/backend/miniprogram-cloud/app/routeRegistry.js)
- [miniprogram-cloud.smoke.test.js](/Users/yun/lindong/backend/tests/miniprogram-cloud.smoke.test.js)
- [env.js](/Users/yun/lindong/miniprogram/config/env.js)
- [cloud-cutover-checklist.md](/Users/yun/lindong/docs/miniprogram/cloud-cutover-checklist.md)

## 4. 当前仍未完成的事

### 4.1 Console

- `backend/routes/admin/*` 兼容壳还没删除
- `middleware/` 还可以继续往公共校验和异常处理收口
- 还没有补课程或订单的真实写链路 live smoke

### 4.2 小程序云开发

- 还没有填真实 `ENV_CLOUD_ENVS`
- 还没有把 `develop` 的 transport 从 `http` 切到 `cloud`
- 还没有部署真实微信云函数环境
- 还没有做小程序开发环境的读链路、登录、下单、模拟支付联调

## 5. 接手顺序建议

### 5.1 如果继续做第三阶段

1. 拿到微信云环境 ID
2. 填 [env.js](/Users/yun/lindong/miniprogram/config/env.js) 的 `ENV_CLOUD_ENVS.develop`
3. 把 `ENV_API_TRANSPORTS.develop` 从 `http` 改成 `cloud`
4. 按 [cloud-cutover-checklist.md](/Users/yun/lindong/docs/miniprogram/cloud-cutover-checklist.md) 先跑读链路联调
5. 读链路稳定后再测 `login -> create order -> mock success`

### 5.2 如果继续收 Console

1. 补一条课程或订单的可回滚真实写链路 live smoke
2. 评估 `backend/routes/admin/*` 兼容壳删除条件
3. 在确认前端引用已稳定后再清理兼容入口

## 6. 重要提醒

- 主数据仍然只认现有主库，不要在微信云开发侧另起主数据
- 云函数接入层只负责 transport / auth / request / response 适配，不要把业务规则写回接入层
- 当前 `docs/sql/reset_test_seed_0326.sql` 已重新导入，`verify:admin-seed` 是绿的；如果后续联调改脏了测试数据，先恢复 seed 再判断是不是代码问题
