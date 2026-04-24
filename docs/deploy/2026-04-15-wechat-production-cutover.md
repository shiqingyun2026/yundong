# 2026-04-15 小程序正式登录 / 正式支付 / 正式通知上线配置清单

本文档用于记录当前仓库已经落下的正式配置入口，以及仍需在外部平台补齐的真实值。

## 1. 已写入仓库的正式配置

### 1.1 小程序正式 AppID

- [project.config.json](/Users/yun/lindong/project.config.json)
- [miniprogram/project.config.json](/Users/yun/lindong/miniprogram/project.config.json)

当前已替换为：

- `wxf18a9c72d851ef7a`

### 1.2 小程序 `release` 运行链路

- [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)

当前已切换为：

- `release.transport = container`
- `release.cloudEnv = tttiyubao-4g141829bdf6a28d`
- `release.service = lindong-api`

### 1.3 Cloudflare Worker 非敏感生产变量

- [backend/wrangler.jsonc](/Users/yun/lindong/backend/wrangler.jsonc)

当前已写入：

- `PAYMENT_PROVIDER_MODE=wechat`
- `GROUP_RESULT_NOTIFICATION_DELIVERY_MODE=wechat`
- `GROUP_RESULT_NOTIFICATION_BATCH_SIZE=20`
- `WX_MINIPROGRAM_APP_ID=wxf18a9c72d851ef7a`
- `WX_MINIPROGRAM_STATE=formal`
- `WX_PAY_NOTIFY_URL=https://lindong-api-247640-5-1304042243.sh.run.tcloudbase.com/api/payments/notify/wechat`

### 1.4 本地 / 云托管环境变量模板

- [backend/.env.example](/Users/yun/lindong/backend/.env.example)
- [backend/.env](/Users/yun/lindong/backend/.env)

## 2. 仍需手动补齐的真实值

这些值当前仓库里仍为空，必须从微信公众平台 / 微信支付商户平台获取后再填：

### 2.1 小程序登录

- `WX_MINIPROGRAM_APP_SECRET`

用途：

- 小程序登录 `code2Session`

### 2.2 微信支付

- `WX_PAY_MCH_ID`
- `WX_PAY_MCH_SERIAL_NO`
- `WX_PAY_PRIVATE_KEY`
- `WX_PAY_PLATFORM_CERT`
- `WX_PAY_API_V3_KEY`

用途：

- JSAPI 下单签名
- 支付结果回调验签
- 回调资源解密

### 2.3 订阅消息

- 小程序端模板 ID：
  - [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js) 中的 `RELEASE_GROUP_RESULT_TEMPLATE_ID`
- 服务端模板字段映射：
  - `WX_GROUP_RESULT_TEMPLATE_FIELD_MAP`

推荐格式：

```json
{
  "title": "thing1",
  "resultText": "thing2",
  "actionText": "thing3",
  "courseStartTime": "time4",
  "courseAddress": "thing5"
}
```

注意：

- 上面这组 `thing1/thing2/...` 只是字段占位名示例
- 必须按你在微信公众平台创建的正式订阅模板字段名实际填写

## 3. 外部平台实际落点

### 3.1 Cloudflare Worker

建议通过 `wrangler secret put` 或 Cloudflare Dashboard Secrets 填以下敏感值：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `WX_MINIPROGRAM_APP_SECRET`
- `WX_PAY_MCH_ID`
- `WX_PAY_MCH_SERIAL_NO`
- `WX_PAY_PRIVATE_KEY`
- `WX_PAY_PLATFORM_CERT`
- `WX_PAY_API_V3_KEY`
- `WX_GROUP_RESULT_TEMPLATE_FIELD_MAP`

可直接使用仓库中已写好的非敏感变量：

- [backend/wrangler.jsonc](/Users/yun/lindong/backend/wrangler.jsonc)

可选脚本模板：

- [set-cloudflare-secrets.template.sh](/Users/yun/lindong/backend/scripts/set-cloudflare-secrets.template.sh)

### 3.2 微信云托管 `lindong-api`

如果小程序正式环境继续以 `wx.cloud.callContainer -> lindong-api` 为主链路，则云托管环境变量也要同步配置：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `PAYMENT_PROVIDER_MODE=wechat`
- `GROUP_RESULT_NOTIFICATION_DELIVERY_MODE=wechat`
- `GROUP_RESULT_NOTIFICATION_BATCH_SIZE=20`
- `WX_MINIPROGRAM_APP_ID=wxf18a9c72d851ef7a`
- `WX_MINIPROGRAM_APP_SECRET`
- `WX_MINIPROGRAM_STATE=formal`
- `WX_PAY_MCH_ID`
- `WX_PAY_MCH_SERIAL_NO`
- `WX_PAY_PRIVATE_KEY`
- `WX_PAY_PLATFORM_CERT`
- `WX_PAY_API_V3_KEY`
- `WX_PAY_NOTIFY_URL=https://lindong-api-247640-5-1304042243.sh.run.tcloudbase.com/api/payments/notify/wechat`
- `WX_GROUP_RESULT_TEMPLATE_FIELD_MAP`

说明：

- 当前联调阶段支付回调地址切到 CloudBase 云托管公网默认域名
- 小程序前台主链路与支付回调统一收口到 `lindong-api`
- 注意：截图中的 CloudBase 默认域名页面提示“仅限开发测试使用”，因此该域名适合当前联调和体验版验证；正式生产建议后续切换到 CloudBase 自定义域名后，再更新商户平台回调地址

## 4. 上线前最后核对

1. 微信公众平台确认正式 AppID 为 `wxf18a9c72d851ef7a`
2. 微信公众平台订阅消息模板已创建，模板 ID 已填入 [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)
3. 微信支付商户平台已配置回调地址：
   - `https://lindong-api-247640-5-1304042243.sh.run.tcloudbase.com/api/payments/notify/wechat`
4. 微信云托管 `lindong-api` 环境变量已补齐
5. 如仍保留 Worker 备用链路，确保其配置不会覆盖当前商户平台回调地址
6. 微信开发者工具清缓存后重新上传 `trial` / `release`
7. 真机验证：
   - 微信登录
   - 创建订单
   - 拉起支付
   - 支付成功回调入账
   - 我的拼团同步
   - 订阅消息授权与投递
