# 微信支付云调用接入设计

日期：2026-05-07

## 背景

邻动 1.0 当前主体功能已完成，剩余收口项是正式微信支付、正式退款、支付退款联调和上线前回归。小程序后端部署在 CloudBase 云托管，商户号已在微信云开发环境完成绑定并授权。正式接入方案采用微信云开发支付云调用，不再把微信支付 v3 直连证书、私钥、平台证书作为生产支付主路径。

## 目标

1. 小程序课包开团和参团可以调起真实微信支付。
2. 支付成功回调能可靠落库，订单变为已支付，课包团成员和人数正确更新。
3. 支付准备、支付回调、重复回调、取消支付具备幂等保护。
4. 后台手动退款和失败团自动退款可以通过云调用发起原路退款。
5. 现有订单、拼团、支付记录、退款记录仍以 MySQL 和 `lindong-api` 业务服务为准。

## 非目标

1. 不重做订单、课包团、后台订单管理模型。
2. 不把核心业务规则迁移到支付云函数。
3. 不继续扩展生产主路径的微信支付 v3 直连接入。
4. 不在小程序端信任前端传入的金额、商品描述或商户单号。

## 推荐方案

采用“云函数支付适配层 + 现有云托管业务后端闭环”。

云函数只负责调用微信支付云能力，包括统一下单、支付回调、申请退款、订单查询和退款查询。`backend/lindong-api` 继续负责订单归属校验、金额计算、商户单号生成、`payment_records` 写入、订单状态流转、课包团入团、成团判断、退款业务规则和后台审计日志。

## 架构组件

### 小程序

相关文件：

- `miniprogram/pages/payment/confirm/index.js`
- `miniprogram/utils/package.js`
- `miniprogram/app.js`

职责：

- 创建课包开团或参团订单仍调用现有云托管接口。
- 支付准备改为调用支付云函数。
- 收到云函数返回的 `payment` 后调用 `wx.requestPayment`。
- 支付成功后继续轮询 `/api/payments/status`，以服务端落库状态作为最终结果。
- 用户取消支付时继续调用 `/api/payments/close`，关闭本地业务订单和支付记录。

### 支付云函数

新增目录：

- `cloudfunctions/wechat-pay/`

职责：

- `type=prepare`：调用后端内部支付准备接口，拿到可信支付参数，再调用 `cloud.cloudPay.unifiedOrder()`。
- `type=refund`：调用后端内部退款准备接口，拿到可信退款参数，再调用 `cloud.cloudPay.refund()`。
- `type=queryOrder`：按商户单号查询微信支付订单，用于联调和补偿。
- `type=queryRefund`：按退款单号查询退款状态，用于联调和补偿。

云函数必须使用 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`。统一下单参数中的 `envId` 使用当前云开发环境 ID，`functionName` 指向支付回调云函数。

### 支付回调云函数

新增目录：

- `cloudfunctions/wechat-pay-callback/`

职责：

- 接收微信支付云调用回调。
- 提取 `return_code`、`result_code`、`out_trade_no`、`transaction_id`、`openid`、`total_fee`、`attach` 等字段。
- 调用后端内部支付确认接口。
- 后端确认成功后返回 `{ errcode: 0 }`，避免微信重复通知。
- 如果后端暂时失败，返回非 0，让微信重试。

### 云托管业务后端

相关文件：

- `backend/lindong-api/routes/payments.js`
- `backend/lindong-api/shared/services/paymentShell.js`
- `backend/lindong-api/shared/services/wechatMiniProgram.js`
- `backend/lindong-api/repositories/paymentRecordsRepository.js`
- `backend/lindong-api/repositories/ordersRepository.js`

职责：

- 新增云支付准备接口，供云函数调用。
- 新增云支付回调确认接口，供回调云函数调用。
- 新增云退款准备和退款确认接口，供支付云函数调用。
- 保留现有 `/api/payments/prepare`、`/api/payments/status`、`/api/payments/close` 对小程序的稳定语义。
- 将生产支付模式扩展为 `cloudpay`，避免继续要求直连支付证书配置。

## 数据流

### 支付准备

1. 用户在小程序确认支付。
2. 小程序创建课包开团或参团订单。
3. 小程序调用 `wechat-pay` 云函数，传入 `type=prepare` 和 `orderId`。
4. 云函数通过可信内部密钥调用 `lindong-api` 的云支付准备接口。
5. 后端校验订单属于当前 `openid` 对应用户，订单状态为 `pending`，金额来自数据库。
6. 后端写入或更新 `payment_records`，返回 `body`、`outTradeNo`、`totalFee`、`attach`。
7. 云函数调用 `cloud.cloudPay.unifiedOrder()`，返回 `payment` 给小程序。
8. 小程序调用 `wx.requestPayment(payment)`。

### 支付成功回调

1. 微信支付完成后调用 `wechat-pay-callback` 云函数。
2. 回调云函数调用后端内部支付确认接口。
3. 后端按 `out_trade_no` 查找 `payment_records`。
4. 后端校验回调金额与订单金额一致。
5. 如果支付记录已是 `paid`，直接返回成功，保持幂等。
6. 如果订单仍是 `pending`，后端执行课包支付成功逻辑：订单变为 `success`，写入 `pay_time` 和 `transaction_id`，加入课包团成员，更新团人数，满员则成团。
7. 回调云函数返回 `{ errcode: 0 }`。

### 退款

1. 后台手动退款或失败团自动退款触发退款准备。
2. 后端校验订单已支付、未退款、允许退款，并生成稳定 `outRefundNo`。
3. 支付云函数调用 `cloud.cloudPay.refund()`。
4. 云函数把申请结果回传后端。
5. 后端将订单、支付记录和后台日志更新为退款中或已退款，具体状态以云调用返回和后续查询结果为准。
6. 查询退款任务或人工补偿可以通过 `queryRefund` 同步最终状态。

## 安全

1. 小程序不能直接传金额、商户单号或退款金额给微信支付。
2. 支付云函数调用后端内部接口时必须带内部密钥，例如 `X-Internal-Payment-Secret`。
3. 内部密钥只配置在云函数和云托管环境变量中，不下发到小程序。
4. 后端必须通过订单归属和 `openid` 校验阻止代付错单。
5. 回调处理必须校验 `out_trade_no`、订单金额、支付状态，避免伪造或串单。
6. 退款接口必须由后台鉴权或内部任务触发，小程序端不能直接触发退款云调用。

## 环境变量

云函数需要：

- `LINDONG_API_BASE_URL`
- `INTERNAL_PAYMENT_SECRET`
- `WX_PAY_SUB_MCH_ID`
- `WX_CLOUD_ENV_ID`
- `WX_PAY_CALLBACK_FUNCTION`

云托管后端需要：

- `PAYMENT_PROVIDER_MODE=cloudpay`
- `INTERNAL_PAYMENT_SECRET`

现有微信登录、MySQL、JWT、CloudBase 身份环境变量继续沿用。

## 错误处理

1. 统一下单失败：云函数返回明确错误，小程序展示“支付暂不可用，请稍后重试”，订单保持 `pending`。
2. 用户取消支付：小程序调用 `/api/payments/close`，后端关闭未支付订单和支付记录。
3. 支付成功但回调延迟：小程序轮询状态，超时进入 processing 结果页。
4. 重复回调：后端识别 `payment_records.status=paid` 后直接返回成功。
5. 金额不一致：后端拒绝确认支付，记录错误日志，不更新订单成功状态。
6. 退款申请失败：后端保持订单已支付状态，记录失败原因，允许后台重试。
7. 退款查询延迟：订单可先标记退款处理中，最终以查询结果同步为已退款或退款失败。

## 测试与验收

### 单元测试

- 云支付准备只允许订单本人支付。
- 云支付准备使用数据库金额，不使用前端金额。
- 支付回调金额不一致时拒绝落库。
- 支付重复回调保持幂等。
- 课包开团支付成功后写入成员并更新人数。
- 课包参团支付成功满员后置为成团。
- 已退款、已关闭、已支付订单不能重复准备支付。
- 退款准备只允许符合业务规则的已支付订单。

### 联调验收

- 开团真实支付成功，跳转课包团详情。
- 参团真实支付成功，人数增加。
- 满员真实支付成功后团状态变为成团。
- 用户取消支付后订单关闭。
- 支付回调延迟时小程序进入处理中，稍后刷新状态正确。
- 后台手动退款成功，订单与支付记录同步退款态。
- 失败团自动退款成功，团状态、订单状态、支付记录一致。
- 微信支付商户后台、`payment_records`、`orders.transaction_id` 能互相对账。

## 实施顺序

1. 新增云支付模式配置和后端内部接口。
2. 新增 `wechat-pay` 云函数并接入统一下单。
3. 修改小程序支付页调用云函数。
4. 新增 `wechat-pay-callback` 云函数并接入后端确认接口。
5. 跑真实支付联调。
6. 新增退款准备、退款云调用和退款状态同步。
7. 跑退款专项联调。
8. 跑支付退款上线前回归。

## 风险

1. 云函数与云托管内部接口网络失败会导致回调重试，后端接口必须幂等。
2. 当前代码已有微信支付 v3 直连实现，实施时要避免两套生产路径并存造成环境变量和行为混乱。
3. 自动失败退款和后台手动退款可能并发触发，退款准备必须锁定订单状态或使用稳定退款单号防重复。
4. 支付成功后入团逻辑是核心资金链路，必须以数据库事务或等价幂等约束保护。
