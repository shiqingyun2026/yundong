# 小程序微信云托管 / Console 标准服务端 交接文档

更新时间：2026-03-30

## 1. 当前最终架构

当前项目已经明确收口为两条入口：

- 小程序：`wx.cloud.callContainer -> 云托管服务 lindong-api`
- Console：继续走标准 HTTP 服务端
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

## 3. 当前验证基线

截至 2026-03-30，已通过：

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

## 4. 今天额外沉淀

### 4.1 页面主链路回归数据已脚本化

[create-test-course.js](/Users/yun/lindong/backend/scripts/create-test-course.js) 现在会稳定准备：

- `"[回归测试] 无活跃拼团课程"`
- `"[回归测试] 可直接参团课程"`

默认 mock 用户 `seed0326_u02` 可直接完成“立即开团”和“去参团”两条页面主链路。

### 4.2 旧云函数路线已清理

已移除：

- `cloudfunctions/`
- `backend/miniprogram-cloud/`
- `docs/miniprogram/cloud-cutover-checklist.md`
- 小程序请求层中的 `callFunction` 兼容代码
- 项目配置中的 `cloudfunctionRoot`

## 5. 当前建议直接认的目录结构

```text
backend/
  shared/
  miniprogram-container/
  console-api/
miniprogram/
  config/
  utils/
docs/
  deploy/
  miniprogram/
```

## 6. 当前仍未完成的部分

### 6.1 Console

- 还没有补课程或订单的真实写链路 live smoke
- `backend/routes/admin/*` 兼容壳还未彻底评估删除

### 6.2 部署层

- `trial / release` 还没有同步切到云托管
- 线上最终发布策略还没定版

## 7. 接手建议

1. 继续先做 console 的真实写链路验证
2. 再决定 admin 兼容壳清理节奏
3. 最后再评估 `trial / release` 是否继续走云托管

## 8. 重要提醒

- 小程序如果继续排障，优先看云托管服务 `lindong-api`，不要再回到旧云函数思路
- Console 不要接入 `callContainer`
- 所有业务规则继续收口在共享层，不要在入口层重新发散
