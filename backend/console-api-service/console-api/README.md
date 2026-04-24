# console-api

`backend/console-api-service` 现在就是 console 后端的唯一真源。

## 运行方式

- 启动服务：`node console-api/server.js`
- 本地 smoke 验证：`npm run verify:console-api-smoke`

## 部署

- CloudBase GitHub 构建目录：`backend/console-api-service`
- Dockerfile：`Dockerfile`
- 当前服务继续保留 `/api/admin/*` 路径前缀，避免影响现有 console 前端调用

## 说明

- 不再依赖 `backend/` 根目录下的旧混合后端壳
- 不再依赖 `deploy-artifacts` 或部署同步脚本
- `console-api/server.js` 默认不启动课程生命周期定时同步，避免和小程序后端重复执行
