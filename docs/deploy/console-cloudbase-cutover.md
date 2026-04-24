# Console 前后端迁移到 CloudBase

更新时间：2026-04-20

## 1. 最终目标架构

Console 体系收口为两套 CloudBase 部署物：

- Console 前端：
  - CloudBase 静态托管
  - 源码目录：[console](/Users/yun/lindong/console)
- Console 后端：
  - CloudBase 云托管
  - 部署目录：[backend/console-api-service](/Users/yun/lindong/backend/console-api-service)

不再建议继续把 Console 生产接口托管在 Cloudflare Workers。

## 2. Console 前端

### 2.1 构建目录

- [console](/Users/yun/lindong/console)

### 2.2 本地构建命令

```bash
cd /Users/yun/lindong/console
npm install
npm run lint
npm run build:cloudbase
```

### 2.3 CloudBase 静态托管配置

- Root Directory：`console`
- Build Command：`npm install && npm run build:cloudbase`
- Output Directory：`dist`
- 环境变量：
  - `VITE_API_BASE_URL=https://<console-api-cloudbase-domain>/api/admin`

### 2.4 路由回退

React Router 子路由刷新必须配置：

- 默认首页文档：`index.html`
- 错误文档或回退文档：`index.html`

## 3. Console 后端

### 3.1 真实部署包

CloudBase 云托管当前建议直接使用独立后端服务目录：

- [backend/console-api-service](/Users/yun/lindong/backend/console-api-service)

这里是 Console 后端当前应使用的正式部署目录。

### 3.2 建议服务名

- `lindong-console-api`

### 3.3 启动方式

部署包内 Docker 启动命令：

```bash
npm run console:start
```

对应入口：

- [console-api/server.js](/Users/yun/lindong/backend/console-api-service/console-api/server.js)

### 3.4 部署包包含内容

- `config`
- `console-api`
- `lib`
- `middleware`
- `repositories`
- `shared`
- `utils`
- `package.json`
- `package-lock.json`
- `Dockerfile`

### 3.5 必备环境变量

至少需要：

- `JWT_SECRET`
- `USE_MYSQL_REPOSITORIES=true`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

如需后台上传、地图、存储等能力，还需要同步配置：

- `STORAGE_PROVIDER=cos`
- `COS_BUCKET`
- `COS_REGION`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`
- `COS_PUBLIC_BASE_URL`
- `COS_UPLOAD_EXPIRES_SECONDS`
- `TENCENT_MAP_KEY`

默认不建议开启：

- `CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC`

避免与小程序后端重复跑课程生命周期定时同步。

## 4. 切换顺序

建议按下面顺序切：

1. 先部署 Console 后端到 CloudBase 云托管。
2. 验证 `/health`、`/api/admin/login`、`/api/admin/dashboard/overview`。
3. 再把 Console 前端静态托管环境变量 `VITE_API_BASE_URL` 切到新的 CloudBase Console API 域名。
4. 再发布 Console 前端。
5. 最后做登录、dashboard、课包列表、新建课包回归。

## 5. 发布后验证

### 5.1 Console 后端

至少验证：

1. `GET /health`
2. `POST /api/admin/login`
3. `GET /api/admin/dashboard/overview`
4. `GET /api/admin/packages`
5. `POST /api/admin/packages`

### 5.2 Console 前端

至少验证：

1. 登录页正常打开
2. 登录成功
3. dashboard 正常
4. `/packages` 页面可打开
5. “课包类型”必填
6. 刷新子路由不 404

## 6. 重要提醒

1. Console 后端与小程序后端是两套独立云托管服务，不要共用一个部署目录。
2. 小程序后端正式部署目录是：
   - [backend/lindong-api](/Users/yun/lindong/backend/lindong-api)
3. Console 后端正式部署目录是：
   - [backend/console-api-service](/Users/yun/lindong/backend/console-api-service)
4. 以后若只改混合 `backend/console-api` 而没有同步并部署 `backend/console-api-service`，CloudBase 线上不会生效。
