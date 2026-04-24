# console-api-service

这是面向运营后台 `console-api` 服务的独立 CloudBase 部署根目录。

## 部署

- CloudBase GitHub 构建目录：`backend/console-api-service`
- Dockerfile：`Dockerfile`
- 容器端口：`8000`

## 启动入口

- `npm run console:start`
- 入口文件：`console-api/server.js`

## 说明

- 该目录当前基于已验证的 `deploy-artifacts/lindong-console-api-deploy` 生成
- 目标是作为可直接部署的源码根目录，逐步替代手工维护的 deploy artifact
