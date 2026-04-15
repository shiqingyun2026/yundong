# 2026-04-15 小程序正式上线待办清单

本文档用于汇总当前仓库在“正式登录 / 正式支付 / 正式通知”方向上仍未完成的事项。

状态说明：

- `[ ]` 未完成
- `[x]` 已完成
- `阻塞上线` 表示不完成不建议发正式版
- `非阻塞优化` 表示可以在首发后继续补，但建议尽快安排

## 1. 当前已完成

- [x] 小程序正式 AppID 已替换为 `wx2cc3da65f3b6bd17`
- [x] 小程序 `release` 环境已切到 `callContainer -> lindong-api`
- [x] 小程序登录代码已改为支持微信 `code2Session`
- [x] 小程序支付代码已改为支持微信支付 V3 预下单 + `wx.requestPayment`
- [x] 微信支付回调已接入签名校验与资源解密
- [x] 订阅通知发送代码已接入微信订阅消息接口
- [x] Cloudflare Worker 非敏感生产变量骨架已写入
- [x] 正式上线配置清单文档已补充

## 2. 阻塞上线

### 2.1 正式环境真实配置

- [ ] 补齐 `WX_MINIPROGRAM_APP_SECRET`
- [ ] 补齐 `WX_PAY_MCH_ID`
- [ ] 补齐 `WX_PAY_MCH_SERIAL_NO`
- [ ] 补齐 `WX_PAY_PRIVATE_KEY`
- [ ] 补齐 `WX_PAY_PLATFORM_CERT`
- [ ] 补齐 `WX_PAY_API_V3_KEY`
- [ ] 补齐 `WX_GROUP_RESULT_TEMPLATE_FIELD_MAP`
- [ ] 补齐小程序正式订阅模板 ID 到 [env.js](/Users/yun/lindong/miniprogram/config/env.js)

### 2.2 Cloudflare Worker / 微信云托管部署

- [ ] 将敏感变量写入 Cloudflare Worker Secrets
- [ ] 将相同关键变量同步写入微信云托管 `lindong-api`
- [ ] 确认 Cloudflare Worker 已部署最新代码
- [ ] 确认 Worker 定时任务已生效
- [ ] 确认微信云托管 `lindong-api` 已部署最新代码

### 2.3 数据库迁移

- [ ] 确认线上已执行 [20260401_payment_records.sql](/Users/yun/lindong/backend/migrations/20260401_payment_records.sql)
- [ ] 确认线上已执行 [20260401_group_result_subscriptions.sql](/Users/yun/lindong/backend/migrations/20260401_group_result_subscriptions.sql)
- [ ] 确认线上已执行 [20260401_group_result_notification_jobs.sql](/Users/yun/lindong/backend/migrations/20260401_group_result_notification_jobs.sql)

### 2.4 支付主链路

- [ ] 真机验证微信登录成功并能拿到真实用户
- [ ] 真机验证创建订单成功
- [ ] 真机验证 `wx.requestPayment` 可正常拉起
- [ ] 真机验证支付成功后微信回调能入账
- [ ] 真机验证支付成功后“我的拼团 / 拼团详情”状态同步正常
- [ ] 真机验证支付取消后的前端提示与状态保持正确

### 2.5 通知主链路

- [ ] 真机验证支付成功页可拉起订阅消息授权
- [ ] 真机验证订阅记录能写入 `group_result_subscriptions`
- [ ] 真机验证终态通知任务能写入 `group_result_notification_jobs`
- [ ] 真机验证 Worker 定时任务可实际发送订阅消息
- [ ] 真机验证用户最终能收到拼团成功 / 失败通知

### 2.6 必须移除或关闭的测试入口

- [ ] 生产环境禁用 [payments.js](/Users/yun/lindong/backend/routes/payments.js) 中的 `POST /api/payments/mock-success`
- [ ] 生产环境移除或隐藏 [payment confirm page](/Users/yun/lindong/miniprogram/pages/payment/confirm/index.wxml) 中的“模拟支付失败”按钮

### 2.7 退款能力

- [ ] 接入微信支付真实退款 API
- [ ] 后台“手动退款”改为真实退款而非仅修改数据库状态
- [ ] 真机验证退款后微信账单与数据库状态一致

## 3. 非阻塞优化

### 3.1 支付成功后的状态确认

- [ ] 支付成功后增加订单状态轮询，确认回调入账后再进入成功态
- [ ] 减少支付完成后短时间内“前端显示成功但订单未同步”的窗口

### 3.2 通知运维能力

- [ ] 增加通知任务处理结果的运维排查文档
- [ ] 增加通知发送失败重试策略说明
- [ ] 评估是否需要补平台证书轮换方案

### 3.3 生产安全与清理

- [ ] 清理生产文档中仍残留的“mock 支付成功主链路”表述
- [ ] 评估是否需要对支付回调接口增加更明确的日志脱敏
- [ ] 评估是否需要对生产环境禁用前端 mock fallback

## 4. 建议执行顺序

1. 先补齐真实环境变量和订阅模板 ID
2. 执行线上数据库迁移
3. 部署 Cloudflare Worker 与微信云托管最新代码
4. 禁用 `mock-success` 和前端模拟支付按钮
5. 跑一轮真机登录 + 支付 + 回调 + 拼团同步
6. 跑一轮订阅授权 + 终态通知投递
7. 最后补真实退款

## 5. 关联文档

- [正式配置清单](/Users/yun/lindong/docs/deploy/2026-04-15-wechat-production-cutover.md)
- [云托管部署复盘](/Users/yun/lindong/docs/deploy/miniprogram-cloud-run-lessons.md)
- [微信云托管交接](/Users/yun/lindong/docs/deploy/wechat-cloud-console-handoff.md)
