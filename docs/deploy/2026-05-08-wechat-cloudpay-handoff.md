# 微信支付云调用接入交接

日期：2026-05-08

## 1. 当前状态

邻动小程序正式微信支付已按“微信云开发云调用 + CloudBase 云托管业务后端”方案接入。

当前支付链路设计为：

1. 小程序创建课包订单。
2. 小程序调用 `wechat-pay` 云函数。
3. `wechat-pay` 云函数调用 `lindong-api` 内部接口生成可信统一下单参数。
4. `wechat-pay` 云函数调用 `cloud.cloudPay.unifiedOrder()`。
5. 小程序拿到 `payment` 后调用 `wx.requestPayment()`。
6. 微信支付完成后回调 `wechat-pay-callback` 云函数。
7. `wechat-pay-callback` 调用 `lindong-api` 内部回调接口。
8. 后端按 `payment_records` 和 `orders` 幂等落库，并执行课包入团/成团逻辑。

当前退款链路已具备后端和云函数基础能力：

1. 后端内部接口生成退款参数。
2. `wechat-pay` 云函数 `type=refund` 调用 `cloud.cloudPay.refund()`。
3. 云函数回传退款结果给后端确认接口。
4. 后端更新 `payment_records` 退款态。

后台手动退款和失败团自动退款原本已有本地状态流转逻辑，真实退款联调仍需要继续确认是否从后台入口完整触发云函数退款。

## 2. 已确认参数

- 小程序 AppID：`wxf18a9c72d851ef7a`
- 云开发环境 ID：`tttiyubao-4g141829bdf6a28d`
- 微信支付子商户号：`1111327161`
- 支付云函数：`wechat-pay`
- 支付回调云函数：`wechat-pay-callback`

## 3. 关键代码位置

小程序：

- `miniprogram/config/env.js`
- `miniprogram/app.js`
- `miniprogram/utils/package.js`
- `miniprogram/pages/package/start/index.js`
- `miniprogram/pages/payment/confirm/index.js`

云函数：

- `cloudfunctions/wechat-pay/index.js`
- `cloudfunctions/wechat-pay/package.json`
- `cloudfunctions/wechat-pay-callback/index.js`
- `cloudfunctions/wechat-pay-callback/package.json`

后端：

- `backend/lindong-api/config/env.js`
- `backend/lindong-api/routes/payments.js`
- `backend/lindong-api/shared/services/paymentShell.js`
- `backend/lindong-api/repositories/paymentRecordsRepository.js`
- `backend/lindong-api/repositories/ordersRepository.js`

文档：

- `docs/deploy/2026-05-07-wechat-cloudpay-runbook.md`
- `docs/superpowers/specs/2026-05-07-wechat-cloudpay-design.md`
- `docs/superpowers/plans/2026-05-07-wechat-cloudpay-implementation.md`

## 4. 已完成提交

核心提交：

- `309cd7d`：新增 `cloudpay` 支付模式。
- `70e07b6`：后端生成云调用统一下单可信参数。
- `c2c0520`：新增后端内部 cloudpay prepare 路由。
- `4ec3336`：新增 cloudpay 支付回调处理。
- `d15ba1a`：新增 `wechat-pay` 和 `wechat-pay-callback` 云函数。
- `e2dc9ed`：小程序确认支付页接入 cloudpay。
- `9c85ed3`：新增 cloudpay 退款准备和确认能力。
- `e6b6333`：修复开团页仍走 mock 支付的问题。
- `8e8cc4f`：修复云函数 Node 16 环境没有全局 `fetch` 的问题。
- `1cb73dd`：给云函数增加 `diagnose` 诊断入口。

## 5. 环境变量

云托管 `lindong-api` 必须配置：

- `PAYMENT_PROVIDER_MODE=cloudpay`
- `INTERNAL_PAYMENT_SECRET`

云函数 `wechat-pay` 和 `wechat-pay-callback` 必须配置：

- `LINDONG_API_BASE_URL`
- `INTERNAL_PAYMENT_SECRET`
- `WX_PAY_SUB_MCH_ID=1111327161`
- `WX_CLOUD_ENV_ID=tttiyubao-4g141829bdf6a28d`
- `WX_PAY_CALLBACK_FUNCTION=wechat-pay-callback`

注意：

- `INTERNAL_PAYMENT_SECRET` 在云函数和云托管后端必须一致。
- 该密钥不能放到小程序端。
- `LINDONG_API_BASE_URL` 必须指向当前发布的 `lindong-api` 云托管服务域名。

## 6. 已排查并修复的问题

### 6.1 体验版仍走 mock 支付

原因：

- 之前只改了 `pages/payment/confirm/index.js`。
- 实际“立即开团”入口走的是 `pages/package/start/index.js`。
- 该页面仍保留旧逻辑：`preparePayment()` 无法返回 `requestPayment` 参数时会调用 `mockPaymentSuccess()`。

修复：

- `miniprogram/pages/package/start/index.js` 已接入 `prepareCloudPayment()`。
- 新增 `miniprogram/tests/package-start-cloudpay.test.cjs` 防止该入口再次漏接 cloudpay。

### 6.2 云函数报 `fetch is not defined`

原因：

- 微信云函数当前运行时是 Node 16。
- Node 16 没有全局 `fetch`。
- 初版云函数用 `fetch()` 调用后端内部接口。

修复：

- `cloudfunctions/wechat-pay/index.js` 和 `cloudfunctions/wechat-pay-callback/index.js` 已改用 `node:http` / `node:https`。
- 新增 `cloudfunctions/tests/node16-http-client.test.cjs`，确保云函数不再依赖全局 `fetch`。

### 6.3 云函数没有 `userId`

原因：

- 云函数天然只能稳定拿到 `OPENID`。
- 早期后端内部 prepare 接口要求小程序/云函数传 `userId`。

修复：

- 后端 `prepareCloudPayUnifiedOrder()` 支持通过 `openId` 查用户，再校验订单归属。
- 内部接口 `/api/payments/internal/cloudpay/prepare` 现在只要求 `orderId` 和 `openId`。

## 7. 当前诊断结果

已在开发者工具 Console 调用：

```js
wx.cloud.callFunction({
  name: 'wechat-pay',
  data: { type: 'diagnose' },
  success: res => console.log('wechat-pay diagnose:', res),
  fail: err => console.error('wechat-pay diagnose failed:', err)
})
```

返回结果已确认：

```json
{
  "buildId": "cloudpay-node16-http-20260508-1018",
  "code": 0,
  "envId": "tttiyubao-4g141829bdf6a28d",
  "hasFetch": false,
  "hasNodeHttpClient": true,
  "openId": "oWMJj3YmtNdMCS9fDVOJYvwnOpyY"
}
```

这说明：

- 小程序调用的是正确云环境。
- `wechat-pay` 已经是 Node 16 HTTP client 修复后的版本。
- `fetch is not defined` 问题在当前云函数版本中应已解决。

建议继续确认 `wechat-pay-callback`：

```js
wx.cloud.callFunction({
  name: 'wechat-pay-callback',
  data: { type: 'diagnose' },
  success: res => console.log('wechat-pay-callback diagnose:', res),
  fail: err => console.error('wechat-pay-callback diagnose failed:', err)
})
```

期望返回包含：

```json
{
  "buildId": "cloudpay-callback-node16-http-20260508-1018",
  "hasNodeHttpClient": true
}
```

## 8. 当前建议联调顺序

### 8.1 支付准备联调

1. 确认 `wechat-pay` 诊断返回正确 buildId。
2. 使用体验版从“立即开团”入口创建订单。
3. 点击支付。
4. 如果失败，优先看 `wechat-pay` 云函数日志。
5. 云函数日志里应不再出现 `fetch is not defined`。

下一层常见错误可能是：

- `LINDONG_API_BASE_URL is required`
- `INTERNAL_PAYMENT_SECRET is required`
- `backend request failed: 403`
- `backend request failed: 404`
- `backend request failed: 500`
- `cloud.cloudPay.unifiedOrder` 参数或商户权限错误

### 8.2 支付回调联调

1. 支付成功后查看 `wechat-pay-callback` 云函数日志。
2. 后端应更新：
   - `payment_records.status=paid`
   - `orders.status=success`
   - `orders.pay_time`
   - `orders.transaction_id` 或 `payment_records.transaction_id`
3. 课包团人数应在回调成功后增加。
4. 满员时课包团状态应变为成团。

### 8.3 退款联调

1. 选一笔未成团已支付订单。
2. 通过 `wechat-pay` 云函数 `type=refund` 或后台退款入口触发退款。
3. 核对微信商户后台退款单。
4. 核对：
   - `orders.status=refunded`
   - `payment_records.status=refunded`
   - 团人数和团状态一致。

## 9. 本地验证命令

已通过的本地验证：

```bash
cd backend && node --test tests/package-orders.test.js
cd backend && node --test tests/miniprogram-routes.mysql.test.js
cd backend && node --test tests/package-group-admin.test.js
node --test miniprogram/tests/package-start-cloudpay.test.cjs
node --test cloudfunctions/tests/node16-http-client.test.cjs
node --check cloudfunctions/wechat-pay/index.js
node --check cloudfunctions/wechat-pay-callback/index.js
node --check miniprogram/pages/package/start/index.js
```

## 10. 发布注意事项

如果修改了小程序支付入口：

- 必须重新上传小程序体验版。

如果修改了 `backend/lindong-api`：

- 必须重新部署云托管后端。

如果修改了 `cloudfunctions/wechat-pay` 或 `cloudfunctions/wechat-pay-callback`：

- 必须在微信开发者工具中右键对应云函数。
- 选择“上传并部署：云端安装依赖”。
- 不要只上传配置。

微信开发者工具必须打开项目根目录：

```text
/Users/yun/lindong
```

不要打开：

```text
/Users/yun/lindong/miniprogram
```

因为只有根目录 `project.config.json` 声明了：

```json
"miniprogramRoot": "./miniprogram",
"cloudfunctionRoot": "cloudfunctions/"
```

## 11. 未完成事项

1. 真实支付完整成功链路仍需继续联调。
2. 真实支付回调落库需在云端环境确认。
3. 真实退款完整链路需继续联调。
4. 后台手动退款入口是否直接触发云函数退款，需要按实际产品口径确认。
5. 支付成功、取消支付、重复回调、重复退款需要做真机回归。

## 12. 工作区注意事项

截至本文档输出时，工作区存在与本次支付交接无关的未提交改动，主要包括：

- `miniprogram/pages/course/detail/index.wxml`
- `miniprogram/pages/course/detail/index.wxss`
- `qa/regression/*`
- `.playwright-mcp/`
- 一个未跟踪的 `docs/2026-04-28-邻动项目1.0交接说明.md`

这些改动不是本次支付修复产生的交付内容，后续处理时不要误删或混入支付提交。
