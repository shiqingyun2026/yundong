# 课包退款状态修复交接

日期：2026-05-08

## 1. 问题摘要

本次排查确认了两个退款相关问题，以及一个后续暴露出的架构限制：

1. 后台对课包订单执行退款后，MySQL 里的 `orders.status`、`payment_records` 可能很快被写成 `refunded`，但用户实际并未收到退款。
2. 在微信开发者工具里直接调用 `wechat-pay` 云函数 `type=refund` 时，用户可以真实收到退款，但 MySQL 里的订单状态可能仍停留在 `success`。
3. CloudPay 历史订单无法通过后台服务端稳定完成真实退款，不论是“后台服务端调云函数退款”，还是“后台服务端直连微信支付普通商户退款”，都已被验证存在架构级阻塞。

这两个问题都和“退款申请受理”和“退款最终到账”被混用有关。

## 2. 历史根因

### 2.1 后台退款被过早写成 `refunded`

历史版本的 `cloudfunctions/wechat-pay/index.js` 在执行：

1. `cloud.cloudPay.refund()`
2. 收到接口层面的 `SUCCESS/ok`

之后，会把这次结果直接当成“退款完成”，立刻调用后端：

- `/api/payments/internal/cloudpay/refund/confirm`

后端收到 confirm 后，会继续把：

- `orders.status -> refunded`
- `payment_records.status -> refunded`

但 `cloud.cloudPay.refund()` 的成功，只能说明：

> 退款申请已受理

不能说明：

> 用户已经到账

所以历史上出现了“库里显示已退款，但用户没收到钱”的误标订单。

### 2.2 直接调用云函数会绕过后台订单状态流

在开发者工具里直接执行：

```js
wx.cloud.callFunction({
  name: 'wechat-pay',
  data: {
    type: 'refund',
    orderId: '...',
    reason: '退款联调测试'
  }
})
```

这条链路只会调用云函数和微信支付退款能力，不会走后台课包退款入口，因此不会自动执行：

- `orders.status = refund_pending`
- 后续后台管理日志落库
- 管理侧同步展示逻辑

所以可能出现“钱退了，但 MySQL 还是 `success`”。

## 3. 已完成修复

### 3.1 后台退款先写 `refund_pending`

后台课包订单退款入口现在会先把订单写成 `refund_pending`，再去调用云函数发起真实退款。

涉及文件：

- `backend/console-api-service/console-api/services/packageAdminService.js`

当前预期行为：

1. 后台点击退款
2. `orders.status -> refund_pending`
3. 云函数发起退款申请
4. 不再把“已受理”误写成“已退款”

### 3.2 `wechat-pay` 云函数不再提前 confirm

`cloudfunctions/wechat-pay/index.js` 已移除以下错误做法：

1. 退款申请成功后立刻调用 `/refund/confirm`
2. 发起退款后立刻 `queryRefund` 并据此推进最终状态
3. 用过宽的通用 `status` 字段误判退款终态

当前 `type=refund` 返回应类似：

```json
{
  "code": 0,
  "data": {
    "status": "refund_pending",
    "accepted": true,
    "settled": false,
    "queryStatus": "",
    "refundQueryResult": null
  }
}
```

这表示：

- 退款请求已提交
- 当前仍是处理中
- 不应自动把 MySQL 改成 `refunded`

### 3.3 增加退款状态同步入口

新增后台同步接口：

```http
POST /api/admin/package-orders/:id/refund/sync
```

用途：

1. 对云侧退款状态做显式复核
2. 修正本地订单状态
3. 兼容历史误标单

当前支持从以下本地状态发起同步：

- `success`
- `refund_pending`
- `refund_failed`
- `refunded`

同步规则：

1. 云侧终态成功：本地改为 `refunded`
2. 云侧处理中：本地改为 `refund_pending`
3. 云侧终态失败：本地改为 `refund_failed`

这意味着：

- “钱退了但本地还是 `success`”可以补同步
- “本地误写成 `refunded` 但用户没收到钱”也可以被纠正回 `refund_pending` 或 `refund_failed`

### 3.4 已确认后台服务端调用云函数退款不可行

在 `console-api-service -> @cloudbase/node-sdk -> callFunction('wechat-pay') -> cloud.cloudPay.refund()` 这条链路上，已实际打到云函数错误：

```text
refund:fail invalid wx openapi access_token
```

这说明：

- 后台服务端虽然可以调用 `wechat-pay` 云函数本身
- 但进入 `cloud.cloudPay.refund()` 时，没有合法的小程序云调用上下文
- 该链路不适合作为后台正式退款通道

这不是配置遗漏，而是当前 CloudBase 云调用能力的使用边界。

### 3.5 已确认后台普通商户直连退款也不适用于 CloudPay 历史订单

后续已尝试将后台退款切成：

- `console-api-service` 直连微信支付 V3 退款接口

并补齐了：

- 商户号
- 商户证书序列号
- 商户私钥
- APIv3 密钥

验证结果表明：

- 直连退款链路本身能走到微信支付
- 但退款接口返回：

```json
{
  "code": "RESOURCE_NOT_EXISTS",
  "message": "订单不存在"
}
```

这里的“订单不存在”不是 MySQL 的 `orders` 表不存在，而是：

- 微信支付当前商户身份下找不到原支付订单

结合支付成功返回中出现的：

- `mchId: 1800008281`
- `subMchId: 1111327161`

可以确认 CloudPay 历史订单是沿 CloudBase/Tencent 服务商链路完成支付的，而不是当前后台直连的普通商户链路。因此：

- CloudPay 历史订单不能用后台普通商户直连退款方案处理

### 3.6 新支付链路与自动退款终态同步

新课包支付链路已切到普通商户微信支付 V3：

1. 小程序 `develop/trial/release` 的 `paymentProvider` 已改为 `wechat`
2. 课包开团、参团支付页统一调用 `/api/payments/prepare`
3. 后台退款继续走 `console-api-service` 直连微信支付 V3 退款接口

新订单支付和退款使用同一个普通商户身份，避免 CloudPay 服务商链路与普通商户直连链路不一致导致的退款失败。

同时，`console-api-service` 已增加自动退款终态轮询：

1. 默认每 60 秒扫描 `order_type = 2` 且 `orders.status = refund_pending` 的课包订单
2. 查询微信支付 V3 退款状态
3. 查询到 `SUCCESS`：本地改为 `orders.status = refunded`，并把 `payment_records.status` 改为 `refunded`
4. 查询到 `ABNORMAL/CLOSED`：本地改为 `orders.status = refund_failed`
5. 查询到处理中：保持 `refund_pending`，下一轮继续查询

停止规则：

- 单笔订单只要仍是 `refund_pending`，就继续参与后续轮询
- 一旦变为 `refunded` 或 `refund_failed`，就自然退出轮询队列
- 当前不按超时自动判失败，避免微信处理慢但最终成功时被误标

相关环境变量：

- `PACKAGE_REFUND_STATUS_SYNC_INTERVAL_MS`：轮询间隔，默认 60000，最小 60000
- `CONSOLE_API_ENABLE_PACKAGE_REFUND_STATUS_SYNC=false`：可临时关闭自动轮询

### 3.7 小程序“我的拼团”退款状态不可进入详情

小程序“我的拼团”列表已按退款状态阻止进入拼团详情：

- `refund_pending`：展示“退款中”，点击卡片无响应
- `refunded`：展示“已退款”，点击卡片无响应
- `refund_failed`：沿用退款异常态，同样不可进入拼团详情

后端列表接口会返回 `can_open_detail = false`，小程序转换为 `canOpenDetail = false` 后直接拦截点击；拦截后不弹 toast，也不跳转课包详情页。

## 4. 当前阶段结论

截至 2026-05-09，本次排查已得到以下结论：

1. “后台点退款立刻写成 `refunded`”这个历史状态错误已经修掉。
2. “退款真实完成前，订单应先停在 `refund_pending`”这条本地状态流已经成立。
3. “历史误标订单可通过 `/refund/sync` 复核纠偏”这项能力已经补上，并已在后台增加手动同步按钮。
4. “后台服务端调 `wechat-pay` 云函数执行 CloudPay 退款”不可作为正式方案。
5. “后台普通商户直连微信支付退款”也不能用于 CloudPay 历史订单。
6. 新课包支付链路已切到普通商户微信支付 V3，新订单可通过后台普通商户 V3 退款闭环。
7. 新订单退款终态已通过 `console-api-service` 自动轮询补齐；人工同步按钮作为兜底。
8. 小程序“我的拼团”退款中、已退款订单不可进入拼团详情。

因此当前准确结论是：

> CloudPay 历史订单的后台真实退款方案，当前仍未闭环；新支付链路订单已按普通商户微信支付 V3 形成支付、退款、终态同步闭环。

## 5. 关键代码位置

后台：

- `backend/console-api-service/console-api/services/packageAdminService.js`
- `backend/console-api-service/console-api/services/cloudPayRefundGateway.js`
- `backend/console-api-service/utils/packageRefundStatusSync.js`
- `backend/console-api-service/console-api/server.js`
- `backend/console-api-service/console-api/controllers/packageAdminController.js`
- `backend/console-api-service/console-api/routes/package-orders.js`
- `backend/console-api-service/console-api/routes/package-groups.js`

业务后端：

- `backend/lindong-api/routes/payments.js`
- `backend/lindong-api/shared/services/paymentShell.js`
- `backend/lindong-api/shared/services/packageRefundService.js`
- `backend/lindong-api/shared/services/paymentRecordStatus.js`
- `backend/lindong-api/shared/services/packageReaders.js`

云函数：

- `cloudfunctions/wechat-pay/index.js`

小程序：

- `miniprogram/config/env.js`
- `miniprogram/utils/package.js`
- `miniprogram/pages/package/start/index.js`
- `miniprogram/pages/payment/confirm/index.js`
- `miniprogram/pages/my/group-buy-list/index.js`
- `miniprogram/pages/my/group-buy-list/index.wxml`
- `miniprogram/pages/group/detail/index.js`

测试：

- `backend/tests/package-orders.test.js`
- `backend/tests/package-group-admin.test.js`
- `backend/tests/package-readers.test.js`
- `backend/tests/package-refund-status-sync.test.cjs`
- `backend/tests/wechat-pay-public-key.test.cjs`
- `miniprogram/tests/package-start-cloudpay.test.cjs`
- `miniprogram/tests/my-group-refund-status.test.cjs`
- `backend/console-api-service/tests/direct-refund-gateway.test.cjs`

## 6. 已完成提交

当前退款改动主要在分支：

- `codex/package-refund-flow`

关键提交：

- `5a31f15`：`feat: implement package refund flow`
- `609a471`：`fix: confirm cloudpay refunds only after settlement`
- `0116e71`：`fix: expose cloudpay refund diagnostics`
- `69f44af`：`feat: use direct wechat pay refunds for package orders`
- `36ac68a`：`zhilian wechatpay`
- `7e49428`：`console order add button`

说明：

- 其中 `69f44af` 是“后台普通商户直连退款”尝试版本，已验证不适用于 CloudPay 历史订单。

## 7. 部署要求

这次退款修复依赖以下服务版本一致：

1. `cloudfunctions/wechat-pay`
2. `backend/lindong-api`
3. `backend/console-api-service`

如果只部署其中一部分，容易出现：

- 云函数仍旧提前 confirm
- 后台已写 `refund_pending`，但云函数逻辑还是旧版
- 同步接口存在，但云函数 `queryRefund` 判定逻辑不是最新版本

## 8. 验证方式

### 7.1 新退款链路验证

操作：

1. 打开后台课包订单页
2. 找一个 `active` 团里的已支付订单
3. 执行退款

预期：

1. 退款接口返回的业务状态应为 `refund_pending`
2. 此时不应直接把 MySQL 写成 `refunded`
3. 若真实退款仍失败，本地状态应推进到 `refund_failed`

### 7.2 云侧退款完成后的同步验证

调用：

```http
POST /api/admin/package-orders/:id/refund/sync
```

预期：

1. 云侧已成功退款：本地变 `refunded`
2. 云侧仍处理中：本地变 `refund_pending`
3. 云侧明确失败：本地变 `refund_failed`

### 7.3 直接调用云函数的验证

如果在微信开发者工具中直接调用：

```js
wx.cloud.callFunction({
  name: 'wechat-pay',
  data: {
    type: 'refund',
    orderId: '8ec0cdd5-b862-4449-88ca-7bbf20e2e968',
    reason: '退款联调测试'
  },
  success: res => console.log('refund success:', res),
  fail: err => console.error('refund failed:', err)
})
```

当前正确理解是：

1. 这能验证“微信支付侧是否真的退款成功”
2. 这不能单独验证“后台订单状态是否同步更新”
3. 若本地订单仍是 `success`，需要再调用 `/refund/sync` 做补同步
4. 这条路径只适合作为临时人工处理 CloudPay 老订单的技术手段，不代表后台正式能力已闭环

### 7.4 后台退款失败的已确认两类原因

#### A. 后台服务端调云函数退款

已确认报错：

```text
refund:fail invalid wx openapi access_token
```

结论：

- 后台服务端不能稳定借道 `wechat-pay` 云函数执行 CloudPay 退款

#### B. 后台普通商户直连微信支付退款

已确认报错：

```json
{
  "code": "RESOURCE_NOT_EXISTS",
  "message": "订单不存在"
}
```

结论：

- CloudPay 历史订单不属于当前后台直连普通商户退款身份
- 微信支付侧找不到原支付订单
- 该方案不适用于 CloudPay 老单

## 9. 历史误标订单处理方式

适用场景：

1. 后台曾操作退款
2. MySQL 已显示 `refunded`
3. 用户实际一直未收到退款

处理步骤：

1. 确认最新版本已部署：
   - `wechat-pay`
   - `lindong-api`
   - `console-api-service`
2. 对目标订单调用：

```http
POST /api/admin/package-orders/:订单ID/refund/sync
```

3. 根据云侧查询结果自动修正：
   - 实际成功：保持 `refunded`
   - 仍处理中：改回 `refund_pending`
   - 实际失败：改成 `refund_failed`

说明：

- 历史误标单不会因为部署新代码而自动恢复
- 必须执行一次同步复核
- 但 `/refund/sync` 只能复核“已经有退款单号/已有退款结果”的订单；它不能替代后台真实发起 CloudPay 退款

## 10. 当前剩余缺口

当前已经修掉“把退款申请误当最终成功”的问题，但当前最大的现实缺口已经明确：

### 10.1 CloudPay 历史订单后台真实退款方案未闭环

现状是：

1. 后台本地状态流已修正
2. CloudPay 历史订单无法通过后台服务端稳定完成真实退款
3. 直接小程序触发云函数退款仍然可用
4. `/refund/sync` 只能用于结果复核，不能解决后台真实退款发起失败

### 10.2 自动退款终态轮询已补齐，退款回调仍可后续评估

当前已补上：

- `console-api-service` 定时扫描 `refund_pending` 课包订单
- 查询到微信退款 `SUCCESS` 后自动回写 `orders/payment_records`
- 查询到 `ABNORMAL/CLOSED` 后自动标记 `refund_failed`

后续建议优先级：

1. 不要再继续投入“后台借道云函数退款”方案
2. 对 CloudPay 历史订单，短期接受“人工/小程序触发退款 + 后台同步状态”
3. 新订单继续使用普通商户直连微信支付 V3，保持支付、退款商户身份一致
4. 增加批量复核脚本，扫描历史误标 `refunded` 订单
5. 后续可再评估微信退款结果通知；即使接入回调，也建议保留轮询作为补偿任务

## 11. 已验证测试

本地已跑过的核心验证：

```bash
cd /Users/yun/lindong/backend
node --test tests/package-orders.test.js
node --test tests/package-group-admin.test.js
node --test tests/package-readers.test.js
node --test tests/package-refund-status-sync.test.cjs

node --test /Users/yun/lindong/miniprogram/tests/my-group-refund-status.test.cjs
node --test /Users/yun/lindong/miniprogram/tests/package-start-cloudpay.test.cjs
node --check /Users/yun/lindong/cloudfunctions/wechat-pay/index.js
node --test /Users/yun/lindong/backend/console-api-service/tests/direct-refund-gateway.test.cjs
node --test /Users/yun/lindong/backend/tests/wechat-pay-public-key.test.cjs
```

其中额外补过的重点用例包括：

1. 后台退款先进入 `refund_pending`
2. 成功团整团退款支持发起
3. `refund/sync` 可处理本地 `success` 订单
4. `refund/sync` 可处理历史本地 `refunded` 误标订单
5. “我的拼团”里退款相关状态统一归在“已失败”页签，卡片右上角显示具体退款状态
6. 直连微信支付退款网关的 prepare / query / confirm 基础流程
7. `refund_pending` 课包订单自动轮询终态
8. “我的拼团”退款中、已退款卡片点击无响应，不进入拼团详情、不弹 toast
