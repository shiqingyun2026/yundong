# Vercel 体验版部署清单

## 1. 部署 backend 到 Vercel

项目创建建议：

* Project Root Directory: `backend`
* Framework Preset: `Other`
* Build Command: 留空
* Output Directory: 留空
* Install Command: 默认

环境变量：

* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`
* `JWT_SECRET`
* `CRON_SECRET`
* `ADMIN_BOOTSTRAP_ID`（可选）
* `ADMIN_BOOTSTRAP_EMAIL`（可选）
* `ADMIN_BOOTSTRAP_USERNAME`（可选）
* `ADMIN_BOOTSTRAP_PASSWORD`（可选）
* `ADMIN_BOOTSTRAP_ROLE`（可选）
* `SUPABASE_STORAGE_BUCKET`（可选）
* `GEOCODE_API_BASE_URL`（可选）

部署完成后先验证：

* `GET /health`
* `POST /api/auth/login`
* `POST /api/admin/login`
* `GET /api/internal/course-lifecycle/sync`，需带 `Authorization: Bearer <CRON_SECRET>`

## 2. 配置 Cron Job

Vercel Cron 触发的是 HTTP `GET` 请求，所以内部同步接口已兼容 `GET`。

推荐调用路径：

* `/api/internal/course-lifecycle/sync`

注意事项：

* 如果是 Vercel Hobby 方案，Cron 只能每天运行一次。
* 如果你希望按分钟级或小时级同步课程状态，需要使用支持高频 Cron 的方案。
* 配置 `CRON_SECRET` 后，Vercel 会在 Cron 请求中自动附带该密钥，可用于保护内部接口。

推荐在确认套餐后，再把 `crons` 写入 `backend/vercel.json`，避免因调度频率不兼容导致部署失败。

## 3. 部署 console

如果部署到 Cloudflare Pages：

* Root Directory: `console`
* Build Command: `npm run build`
* Output Directory: `dist`
* 环境变量：`VITE_API_BASE_URL=https://lindongyun.vercel.app/api/admin`

如果部署到 Vercel：

* Root Directory: `console`
* Framework Preset: `Vite`
* 环境变量：`VITE_API_BASE_URL=https://lindongyun.vercel.app/api/admin`

## 4. 小程序体验版配置

小程序环境地址定义在：

* `miniprogram/config/env.js`

当前默认值：

* `develop` -> `http://127.0.0.1:8000`
* `trial` -> `https://lindongyun.vercel.app`
* `release` -> `https://lindongyun.vercel.app`

实际部署后，需要把 `trial` 和 `release` 改成真实 API 域名。

微信公众平台需要配置：

* `request` 合法域名：你的 API 域名

## 5. 联调顺序

建议按下面顺序验证：

1. 后端健康检查和环境变量
2. 后台登录、课程管理、图片上传
3. 小程序登录、首页、课程详情、拼团、支付确认
4. 手动调用内部同步接口，确认课程状态同步正常
5. 再开启 Vercel Cron
