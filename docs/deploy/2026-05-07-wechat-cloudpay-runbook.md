# 微信支付云调用部署 Runbook

日期：2026-05-07

## 已确认参数

- 微信支付子商户号 `subMchId`：`1111327161`
- 微信云开发环境 ID `envId`：`tttiyubao-4g141829bdf6a28d`
- 支付云函数名：`wechat-pay`
- 支付回调云函数名：`wechat-pay-callback`

## 环境变量

云函数 `wechat-pay` 和 `wechat-pay-callback`：

- `LINDONG_API_BASE_URL`
- `INTERNAL_PAYMENT_SECRET`
- `WX_PAY_SUB_MCH_ID=1111327161`
- `WX_CLOUD_ENV_ID=tttiyubao-4g141829bdf6a28d`
- `WX_PAY_CALLBACK_FUNCTION=wechat-pay-callback`

云托管 `lindong-api`：

- `PAYMENT_PROVIDER_MODE=cloudpay`
- `INTERNAL_PAYMENT_SECRET`

`INTERNAL_PAYMENT_SECRET` 两侧必须一致，且不能下发到小程序端。

## 发布顺序

1. 部署 `backend/lindong-api` 到 CloudBase 云托管。
2. 上传并部署 `cloudfunctions/wechat-pay`。
3. 上传并部署 `cloudfunctions/wechat-pay-callback`。
4. 发布小程序体验版。

## 支付冒烟

1. 使用体验版登录。
2. 选择课包并开团。
3. 确认支付并完成真实微信支付。
4. 核对 `orders.status=success`。
5. 核对 `payment_records.status=paid`。
6. 核对微信商户后台订单、`payment_records.out_trade_no`、`payment_records.transaction_id` 能互相对账。
7. 核对课包团人数只在支付回调确认后增加。

## 退款冒烟

1. 选择一笔未成团已支付订单。
2. 通过 `wechat-pay` 云函数 `type=refund` 或后台退款入口发起退款。
3. 核对微信商户后台退款单。
4. 核对 `orders.status=refunded`。
5. 核对 `payment_records.status=refunded`。
6. 核对课包团人数、团状态和待支付订单关闭结果一致。

## 回滚

1. 将云托管 `PAYMENT_PROVIDER_MODE` 改回 `mock`。
2. 重新部署 `backend/lindong-api`。
3. 小程序 `paymentProvider` 改回 `mock` 并重新发布体验版。

## 注意事项

- 小程序端不能传金额、商户单号或退款金额。
- 云函数只做微信支付云调用适配，订单金额和状态仍由 `lindong-api` 决定。
- 支付回调可能重复到达，后端必须按 `payment_records` 和 `orders` 状态幂等处理。
- 自动失败退款和后台手动退款可能并发触发，真实联调时必须覆盖重复退款拦截。
