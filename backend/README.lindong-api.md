# lindong-api

这是面向小程序 `lindong-api` 服务的独立 CloudBase 部署根目录模板来源。

## 部署

- CloudBase GitHub 构建目录：`backend/lindong-api`
- Dockerfile：`Dockerfile`
- 容器端口：`8000`

## 启动入口

- `npm run miniprogram-container:start`
- 入口文件：`miniprogram-container/server.js`

## 说明

- 该目录由 `backend/` 源码通过部署同步脚本生成
- 目标是作为可直接部署的源码根目录，逐步替代手工维护的 deploy artifact
