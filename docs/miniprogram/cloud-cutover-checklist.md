# 邻动体适能小程序 云开发切流清单

## 1. 目标

本文档用于把小程序开发环境从 `http` 切到 `cloud` 前的准备工作收成一份可执行清单。

当前约束不变：

- 主数据仍然只认现有主库
- 云函数只做身份、入参、出参适配
- 小程序先切开发环境，再看体验版和正式版

## 2. 当前前提

当前仓库已经具备：

- [env.js](/Users/yun/lindong/miniprogram/config/env.js) 支持按环境切换 `http` / `cloud`
- [request.js](/Users/yun/lindong/miniprogram/utils/request.js) 已支持 `wx.cloud.callFunction`
- [app.js](/Users/yun/lindong/miniprogram/app.js) 已支持 `wx.cloud.init`
- [miniProgramGateway](/Users/yun/lindong/backend/miniprogram-cloud/functions/miniProgramGateway/index.js) 已接上当前 8 条小程序相关路由
- [miniprogram-cloud.smoke.test.js](/Users/yun/lindong/backend/tests/miniprogram-cloud.smoke.test.js) 可在本地验证云函数网关骨架

## 3. 切流前检查

- [ ] 运行 `cd /Users/yun/lindong/backend && npm run verify:miniprogram-cloud-smoke`
- [ ] 运行 `cd /Users/yun/lindong/backend && npm run verify:group-rules`
- [ ] 确认 [env.js](/Users/yun/lindong/miniprogram/config/env.js) 里的 `ENV_CLOUD_ENVS` 不再是 `TODO_WECHAT_CLOUD_ENV`
- [ ] 确认微信云开发控制台中已创建目标环境
- [ ] 确认云函数名仍为 `miniProgramGateway`
- [ ] 确认云函数部署代码来自 [backend/miniprogram-cloud](/Users/yun/lindong/backend/miniprogram-cloud)
- [ ] 确认云函数运行时能访问现有主库所需配置

## 4. 开发环境切换步骤

1. 在微信云开发控制台创建或确认开发环境。
2. 把 [env.js](/Users/yun/lindong/miniprogram/config/env.js) 中 `develop` 对应的 `ENV_CLOUD_ENVS.develop` 填成真实云环境 ID。
3. 保持 `trial` 和 `release` 先不切，除非开发环境联调已经稳定。
4. 把 `ENV_API_TRANSPORTS.develop` 从 `http` 改成 `cloud`。
5. 在微信开发者工具重新编译小程序。
6. 确认启动日志里没有 `wx.cloud.init failed`。

## 5. 开发环境联调范围

先做读链路：

- [ ] `GET /api/courses`
- [ ] `GET /api/courses/:id`
- [ ] `GET /api/courses/:id/active-group`
- [ ] `GET /api/groups/:id`
- [ ] `GET /api/user/groups`

读链路稳定后再做写链路：

- [ ] `POST /api/auth/login`
- [ ] `POST /api/orders`
- [ ] `POST /api/payments/mock-success`

## 6. 联调观察点

- [ ] 小程序控制台里请求日志由 `[request:http]` 变成 `[request:cloud]`
- [ ] 云函数错误能被包成统一 `code/message/errorCode`
- [ ] 登录后 token 写入逻辑与 HTTP 模式保持一致
- [ ] 下单和模拟支付成功后，首页、课程详情、我的拼团状态一致
- [ ] 任一路由失败时，不会出现白屏或无提示失败

## 7. 切换策略

- `develop` 先切到 `cloud`
- `trial` 继续保持 `http`
- `release` 继续保持 `http`

满足下面条件后，再考虑推进到 `trial`：

- 开发环境读链路联调通过
- 开发环境登录、下单、模拟支付成功联调通过
- 没有发现云函数侧重复实现业务规则

## 8. 回退方式

如果开发环境切到 `cloud` 后出现阻塞问题：

1. 把 [env.js](/Users/yun/lindong/miniprogram/config/env.js) 里的 `ENV_API_TRANSPORTS.develop` 改回 `http`
2. 重新编译小程序
3. 保留 `ENV_CLOUD_ENVS.develop`，但暂不使用

这样可以快速退回现有 HTTP 链路，而不影响已部署的云函数骨架。
