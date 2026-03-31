# 2026-03-30 Console / 微信云托管 交接补充

## 1. 今天实际收口到哪里

这轮已经不再是“云开发骨架准备完成”，而是已经收口到可直接继续开发和回归的状态：

- 小程序开发环境已切到 `wx.cloud.callContainer`
- 云托管服务已部署为 `lindong-api`
- 小程序 `develop` 环境已使用云环境 `cloud1-4glzoev0baf7b187`
- console 继续保持标准 HTTP 形态，不依赖微信专用链路

## 2. 当前验证结论

截至 2026-03-30，下面这些都已经验证通过：

- `cd /Users/yun/lindong/backend && npm run verify:console-api-smoke`
- `cd /Users/yun/lindong/backend && npm run verify:group-rules`
- `cd /Users/yun/lindong/backend && npm run verify:admin-seed`
- `cd /Users/yun/lindong/qa/regression && npm run test:console-live`
- 小程序真实服务级链路：
  - `GET /api/courses`
  - `GET /api/courses/:id`
  - `GET /api/courses/:id/active-group`
  - `POST /api/auth/login`
  - `POST /api/orders`
  - `POST /api/payments/mock-success`
  - `GET /api/user/groups`
  - `GET /api/groups/:id`
- 小程序页面级链路：
  - 首页读链路通过
  - 课程详情读链路通过
  - 登录通过
  - `create order -> mock success` 通过
  - “我的拼团”与详情页状态同步通过

## 3. 当前关键文件

### 3.1 小程序云托管入口

- [env.js](/Users/yun/lindong/miniprogram/config/env.js)
- [app.js](/Users/yun/lindong/miniprogram/app.js)
- [request.js](/Users/yun/lindong/miniprogram/utils/request.js)
- [auth.js](/Users/yun/lindong/miniprogram/utils/auth.js)
- [course.js](/Users/yun/lindong/miniprogram/utils/course.js)

### 3.2 小程序专用后端入口

- [app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
- [server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
- [Dockerfile](/Users/yun/lindong/backend/Dockerfile)
- [.dockerignore](/Users/yun/lindong/backend/.dockerignore)

### 3.3 回归与交接文档

- [create-test-course.js](/Users/yun/lindong/backend/scripts/create-test-course.js)
- [regression-checklist.md](/Users/yun/lindong/docs/miniprogram/regression-checklist.md)
- [handoff.md](/Users/yun/lindong/docs/miniprogram/handoff.md)
- [miniprogram-cloud-run-lessons.md](/Users/yun/lindong/docs/deploy/miniprogram-cloud-run-lessons.md)

## 4. 今天顺手完成的收尾

### 4.1 页面回归数据已收成可重复脚本

`npm run seed:regression-course` 现在会稳定准备两门课：

- `"[回归测试] 无活跃拼团课程"`：用于验证“立即开团 -> 确认支付 -> mock success”
- `"[回归测试] 可直接参团课程"`：用于验证“去参团 -> 确认支付 -> mock success”

默认 mock 用户 `seed0326_u02` 可以直接使用这两门课完成主链路回归。

### 4.2 旧云函数试错路径已移除

本轮已经把未继续采用的旧路径清理掉，避免后续接手时误判当前真实方案：

- 删除仓库根目录 `cloudfunctions/` 中的 `miniProgramGateway`
- 删除 `backend/miniprogram-cloud/` 接入层骨架
- 删除 `docs/miniprogram/cloud-cutover-checklist.md`
- 删除 `verify:miniprogram-cloud-smoke`
- 移除小程序请求层中的 `callFunction` 旧 transport
- 移除微信开发者工具项目配置中的 `cloudfunctionRoot`

## 5. 当前还没做的事

### 5.1 Console

- 还没有补课程或订单的真实写链路 live smoke

### 5.2 小程序

- `trial / release` 还没有同步到云托管
- 还没有决定线上环境是否也完全切到云托管

## 6. 接手顺序建议

1. 先补 console 一条可回滚真实写链路 live smoke
2. 再决定 `trial / release` 是否继续切到云托管

## 7. 重要提醒

- 小程序当前真实方案是 `callContainer -> lindong-api`，不要再按 `miniProgramGateway` 的旧路线排障
- 主数据仍然只认现有主库，不要在微信云侧另起一套业务数据
- 如果页面回归数据被联调污染，先运行 `cd /Users/yun/lindong/backend && npm run seed:regression-course`
- console 后端代码入口统一以 `backend/console-api/*` 为准，不再保留 `backend/routes/admin/*` 兼容壳
