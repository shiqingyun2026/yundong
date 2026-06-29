# 2026-06-29 本地 Console 与小程序联调交接

## 背景

本轮本地联调目标是：在本机同时打开运营后台 Console 与微信小程序开发版，让两端都连接测试库 `tiyubao-pre`，验证课包拼团配置、3-4 人团 / 5-6 人团等新规则，以及课包上下架状态展示。

本地链路当前拆成三段：

```txt
Console 前端:       http://localhost:3100
Console 后台 API:   http://localhost:8100/api/admin
小程序后端 API:      http://127.0.0.1:8000/api/*
数据库:             tiyubao-pre
```

## 当前本地配置

### Console 前端

`console/.env` 当前应指向本地 Console 后台：

```txt
VITE_API_BASE_URL=http://localhost:8100/api/admin
```

使用 `localhost` 而不是 `127.0.0.1`，是为了避免 Console 页面来源与 API cookie 域名不一致。

### Console 后台

`backend/.env` 当前使用 MySQL repository，并连接 CloudBase SQL 外网地址。不要把数据库密码写入文档；以本机 `.env` 为准。

关键字段：

```txt
USE_MYSQL_REPOSITORIES=true
MYSQL_HOST=<CloudBase SQL 外网地址>
MYSQL_PORT=<CloudBase SQL 外网端口>
MYSQL_DATABASE=tiyubao-pre
```

### 小程序开发版

`miniprogram/config/env.js` 的 `develop` 当前被临时切到本地 HTTP：

```js
ENV_API_BASE_URLS.develop = 'http://127.0.0.1:8000'
ENV_API_TRANSPORTS.develop = 'http'
```

`trial` / `release` 仍保持 CloudBase 云托管 `container` 链路。

## 启动顺序

### 1. 启动 Console 后台

```bash
cd /Users/yun/lindong/backend
CONSOLE_API_ENABLE_PACKAGE_REFUND_STATUS_SYNC=false CONSOLE_API_PORT=8100 npm run console:dev
```

健康检查：

```bash
curl -i http://localhost:8100/health
```

预期返回：

```json
{"ok":true,"service":"lindong-console-api"}
```

### 2. 启动 Console 前端

```bash
cd /Users/yun/lindong/console
npm run dev
```

访问：

```txt
http://localhost:3100/
```

本地默认管理员账号：

```txt
admin / admin123456
```

### 3. 启动小程序本地后端

使用仓库根 `backend` 的脚本，不要直接跑 `backend/lindong-api/server.js`。

```bash
cd /Users/yun/lindong/backend
PORT=8000 npm run dev
```

该命令实际启动：

```txt
backend/lindong-api/miniprogram-container/server.js
```

健康检查：

```bash
curl -i http://127.0.0.1:8000/health
```

预期返回：

```json
{"ok":true}
```

### 4. 手动执行课包生命周期同步

本地小程序后端 `miniprogram-container/server.js` 只提供接口，不会自动执行课包生命周期同步。启动 `8000` 后，如果要验证课包上下架，一定要执行一次同步。

推荐方式：调用内部接口，前提是 `backend/.env` 已配置 `CRON_SECRET`。

```bash
curl -i -X POST 'http://127.0.0.1:8000/api/internal/package-lifecycle/sync' \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

如果只是本地排查，也可以在 `backend` 目录直接调用同步函数：

```bash
node -e "require('dotenv').config(); const { syncAllPackageLifecycles } = require('./lindong-api/utils/packageLifecycle'); syncAllPackageLifecycles().then(result => { console.log(result); process.exit(0); }).catch(error => { console.error(error); process.exit(1); });"
```

同步后可在 DMS 或只读 SQL 中确认目标课包：

```sql
SELECT id, name, status, publish_time, unpublish_time, updated_at
FROM course_packages
WHERE id = 'PKG-20260629-0011';
```

状态含义：

```txt
0 = 已下架
1 = 已上架
2 = 待上架
```

## 微信开发者工具

打开目录：

```txt
/Users/yun/lindong/miniprogram
```

本地设置中确认勾选：

```txt
不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

如果看到：

```txt
request:fail http://127.0.0.1:8000/api/packages
```

优先检查 `8000` 是否启动：

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
curl -i http://127.0.0.1:8000/health
```

## 状态展示口径

Console 课包管理列表与详情已调整为只展示数据库持久化状态，不再按 `publish_time` / `unpublish_time` 动态计算展示状态。

也就是说：

```txt
数据库 status=2，即使 publish_time 已到，Console 仍显示“待上架”
数据库 status=1，即使 unpublish_time 已过，Console 仍显示“已上架”
```

状态变化应由生命周期同步任务负责落库，避免 Console、小程序、详情页各自计算导致口径漂移。

## 已知注意事项

1. `console/dist/` 是构建产物，本地联调不要直接修改或依赖它。
2. 如果 Console 登录出现 `Failed to fetch`，优先检查 `8100` 是否启动，以及 CORS 是否返回 `Access-Control-Allow-Origin`。
3. 如果 Console 能显示“已上架”但小程序看不到课包，先查数据库 `course_packages.status`；小程序当前只展示实际 active 的课包，状态未同步时可能看不到。
4. 如果接口报 `Unknown column 'min_success_count'`，说明测试库还没执行 `docs/sql/package_group_min_success_count_migration.sql`。
5. 后端有一个既有测试失败与本轮状态口径无关：`admin package group coach assignment persists default coach and per-lesson overrides` 期望 5、实际 10。

## 本轮关键验证

已通过：

```bash
node --test --test-name-pattern "admin package (list uses persisted|detail uses persisted)" tests/package-group-admin.test.js
node --test miniprogram/tests/env-config.test.cjs
```

本地接口验证：

```txt
GET http://localhost:3100/        -> 200
GET http://localhost:8100/health  -> 200
GET http://127.0.0.1:8000/health  -> 200
GET http://127.0.0.1:8000/api/packages -> 200
```
