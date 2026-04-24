# lindong-api

这是面向小程序 `lindong-api` 服务的独立 CloudBase 部署根目录。

## 部署

- CloudBase GitHub 构建目录：`backend/lindong-api`
- Dockerfile：`Dockerfile`
- 容器端口：`8000`

## 启动入口

- `npm run miniprogram-container:start`
- 入口文件：`miniprogram-container/server.js`

## 说明

- `backend/lindong-api` 现在就是小程序后端的唯一真源
- CloudBase GitHub 部署时可直接选择这个子目录作为构建根目录
- 不再依赖 `deploy-artifacts` 或部署同步脚本
