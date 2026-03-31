# 2026-03-31 Console / 微信云托管最新交接

## 1. 今天最新收口结论

截至 2026-03-31，当前项目已经进一步收口为下面的明确状态：

- 小程序 `develop` 已切到 `wx.cloud.callContainer -> lindong-api`
- 小程序 `trial` 已切到 `wx.cloud.callContainer -> lindong-api`
- 小程序 `release` 仍未切云托管，当前仍走 HTTP
- Console 继续保持标准 HTTP 服务端，不接入微信专用链路
- Console 后端代码入口统一以 `backend/console-api/*` 为准

## 2. 今天完成了什么

### 2.1 Console 真实写链路 live smoke 已补齐一条

今天已经补上一条可回滚的真实写链路 live smoke：

- 文件：[console.live.spec.ts](/Users/yun/lindong/qa/regression/tests/console.live.spec.ts)
- 覆盖内容：编辑一门已 seed 的待上架课程，并在测试末尾回滚 `coach_intro`
- 价值：补上之前缺失的课程/订单级真实写操作验证空白

本次实际跑通命令：

- `cd /Users/yun/lindong/qa/regression && npm run test:console-live -- --grep "seeded pending course can be updated and rolled back"`

验证结果：

- `1 passed`

### 2.2 `backend/routes/admin/*` 兼容壳已移除

今天已经确认并完成清理：

- 主 `backend` 服务实际挂载的是 `backend/console-api/routes`
- 原 `backend/routes/admin/*` 已经只是单行 re-export，没有独立业务逻辑
- 仓库内也没有其它真实调用方继续依赖这些兼容壳文件

本次已完成的收口：

- 删除 `backend/routes/admin/*`
- 把 [internal.js](/Users/yun/lindong/backend/routes/internal.js) 对 `_helpers` 的引用改为直接指向 `backend/console-api/routes/_helpers`

## 3. 当前环境状态

以当前仓库代码为准：

- `develop`
  - transport: `container`
  - cloud env: `cloud1-4glzoev0baf7b187`
  - service: `lindong-api`
- `trial`
  - transport: `container`
  - cloud env: `cloud1-4glzoev0baf7b187`
  - service: `lindong-api`
- `release`
  - transport: `http`
  - cloud env: 未配置，仍是占位值
  - service: 未配置，仍是占位值

对应配置文件：

- [env.js](/Users/yun/lindong/miniprogram/config/env.js)

这意味着：

- `trial` 已经切到微信云托管
- 旧文档里“`trial / release` 还没有同步切到云托管”的表述已经过时
- 现在真正待决策的只剩 `release`

## 4. 对 `release` 的建议结论

结论：建议 `release` 继续切到微信云托管，但不要直接裸切，应该在 `trial` 真机验收通过后再切。

支持这个结论的主要原因：

- 当前小程序目标架构已经稳定收口为 `callContainer -> lindong-api`
- `develop` 与 `trial` 已经一致，继续让 `release` 保持 HTTP 会制造长期环境分叉
- 小程序主链路验证已经覆盖到登录、下单、mock 支付成功、我的拼团等真实业务流程
- Console 继续走标准 HTTP，不会和小程序云托管切换互相牵连

## 5. 建议的执行顺序

1. 先在 `trial` 完成一轮真机验收
2. 验收通过后，把 `release` 配置切到与 `trial` 一致
3. 再做一次 `release` 发版前冒烟

建议 `trial` 至少覆盖这些验收项：

- 首页课程列表
- 课程详情
- 微信登录
- 立即开团 / 去参团
- 创建订单
- mock 支付成功回流
- 我的拼团与详情同步

## 6. `release` 切换前置条件

在真正切 `release` 之前，至少需要完成：

- 在 [env.js](/Users/yun/lindong/miniprogram/config/env.js) 把 `release` transport 从 `http` 改成 `container`
- 配置 `release` 对应的云环境 ID
- 配置 `release` 对应的云托管服务名
- 用正式发布前配置跑一轮小程序主链路冒烟

## 7. 当前建议直接认的入口

- 小程序云托管入口：
  - [app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
  - [server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
- Console 独立服务入口：
  - [app.js](/Users/yun/lindong/backend/console-api/app.js)
  - [server.js](/Users/yun/lindong/backend/console-api/server.js)
  - [routes](/Users/yun/lindong/backend/console-api/routes)
- 小程序环境配置入口：
  - [env.js](/Users/yun/lindong/miniprogram/config/env.js)
  - [request.js](/Users/yun/lindong/miniprogram/utils/request.js)

## 8. 重要提醒

- 小程序当前真实方案是 `wx.cloud.callContainer -> lindong-api`
- `trial` 已经切云托管，不要再按“`trial` 尚未切换”去排障
- `release` 是否切换，现在是部署策略决策，不再是技术路线待定
- Console 不要接入 `callContainer`
- 所有业务规则继续收口在 `backend/shared/*`
