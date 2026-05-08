# 课包退款状态修复交接

日期：2026-05-08

## 1. 问题摘要

本次排查确认了两个退款相关问题：

1. 后台对课包订单执行退款后，MySQL 里的 `orders.status`、`payment_records` 可能很快被写成 `refunded`，但用户实际并未收到退款。
2. 在微信开发者工具里直接调用 `wechat-pay` 云函数 `type=refund` 时，用户可以真实收到退款，但 MySQL 里的订单状态可能仍停留在 `success`。

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

## 4. 关键代码位置

后台：

- `backend/console-api-service/console-api/services/packageAdminService.js`
- `backend/console-api-service/console-api/services/cloudPayRefundGateway.js`
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

- `miniprogram/utils/package.js`
- `miniprogram/pages/my/group-buy-list/index.js`
- `miniprogram/pages/my/group-buy-list/index.wxml`
- `miniprogram/pages/group/detail/index.js`

测试：

- `backend/tests/package-orders.test.js`
- `backend/tests/package-group-admin.test.js`
- `backend/tests/package-readers.test.js`
- `miniprogram/tests/my-group-refund-status.test.cjs`

## 5. 已完成提交

当前退款改动主要在分支：

- `codex/package-refund-flow`

关键提交：

- `5a31f15`：`feat: implement package refund flow`
- `609a471`：`fix: confirm cloudpay refunds only after settlement`

## 6. 部署要求

这次退款修复依赖以下服务版本一致：

1. `cloudfunctions/wechat-pay`
2. `backend/lindong-api`
3. `backend/console-api-service`

如果只部署其中一部分，容易出现：

- 云函数仍旧提前 confirm
- 后台已写 `refund_pending`，但云函数逻辑还是旧版
- 同步接口存在，但云函数 `queryRefund` 判定逻辑不是最新版本

## 7. 验证方式

### 7.1 新退款链路验证

操作：

1. 打开后台课包订单页
2. 找一个 `active` 团里的已支付订单
3. 执行退款

预期：

1. 退款接口返回的业务状态应为 `refund_pending`
2. `wechat-pay` 云函数返回应包含：
   - `status = refund_pending`
   - `accepted = true`
   - `settled = false`
3. 此时不应直接把 MySQL 写成 `refunded`

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

## 8. 历史误标订单处理方式

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

## 9. 当前剩余缺口

当前已经修掉“把退款申请误当最终成功”的问题，但还有一个现实缺口：

### 9.1 还没有自动到账回调闭环

现状是：

1. 发起退款后可以正确停在 `refund_pending`
2. 需要显式调用 `/refund/sync` 才能把终态推进到 `refunded` 或 `refund_failed`

也就是说，目前更像是：

- 手动补偿式对账

还不是：

- 自动退款完成回调闭环

后续建议优先级：

1. 给后台订单页增加“同步退款状态”按钮
2. 增加批量复核脚本，扫描历史误标 `refunded` 订单
3. 评估是否可接入更稳定的退款终态回调或定时对账任务

## 10. 已验证测试

本地已跑过的核心验证：

```bash
cd /Users/yun/lindong/backend
node --test tests/package-orders.test.js
node --test tests/package-group-admin.test.js
node --test tests/package-readers.test.js

node --test /Users/yun/lindong/miniprogram/tests/my-group-refund-status.test.cjs
node --check /Users/yun/lindong/cloudfunctions/wechat-pay/index.js
```

其中额外补过的重点用例包括：

1. 后台退款先进入 `refund_pending`
2. 成功团整团退款支持发起
3. `refund/sync` 可处理本地 `success` 订单
4. `refund/sync` 可处理历史本地 `refunded` 误标订单
5. “我的拼团”里退款相关状态统一归在“已失败”页签，卡片右上角显示具体退款状态
