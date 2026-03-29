# console-api

`console-api/` 是从现有 `backend/routes/admin` 往独立后台服务形态拆出的第一步。

当前状态：

- 已有独立 `app.js` 和 `server.js`
- 独立服务仍保留 `/api/admin/*` 路径前缀，避免影响现有 console 前端调用
- `routes/index.js` 已从主 `backend/app.js` 中抽离出来
- `auth` 与 `dashboard` 已迁到 `backend/console-api/routes/*`
- `logs`、`upload`、`accounts` 也已迁到 `backend/console-api/routes/*`
- `orders` 也已迁到 `backend/console-api/routes/*`
- `groups` 也已迁到 `backend/console-api/routes/*`
- `courses` 也已迁到 `backend/console-api/routes/*`
- 当前 `backend/routes/admin/*` 已全部退化为兼容壳

当前运行方式：

- 综合后端：`node server.js`
- 独立 console 服务：`node console-api/server.js`

注意事项：

- `console-api/server.js` 默认不启动课程生命周期定时同步，避免和综合后端重复执行
- 如果后续要把 console 服务单独长期运行，再按部署方案决定是否开启 `CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC=true`

下一步建议：

1. 把 `backend/routes/admin/*` 逐步迁到 `backend/console-api/routes/*`
2. 再继续拆 controllers / middleware / services
3. 等 console 前端配置稳定后，再考虑把路径前缀从 `/api/admin/*` 调整为更纯粹的 console-api 形态
