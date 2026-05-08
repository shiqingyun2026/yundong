# 2026-05-08 Console 自定义域名切换交接

## 目标

将运营后台前端与后台接口统一切到同一自定义域名：

- 前端入口：`https://tiantiantiyubao.cn/console`
- 后台接口：`https://tiantiantiyubao.cn/api/admin/*`

这样可以避免继续从 CloudBase 默认静态域名访问后台页面，减少跨域问题。

## 当前结论

### 1. 路由结构

CloudBase 自定义域名当前应保持如下三条路由：

- `/api/admin` -> `lindong-console-api`
- `/api` -> `lindong-api`
- `/console` -> 静态托管 `staticstore`

当前判断：

- `/api/admin` 路由已配对到 `lindong-console-api`
- `/api` 路由已配对到 `lindong-api`
- `/console` 路由已配对到静态托管

### 2. 路径透传

当前建议保持：

- `/api/admin`：已开启
- `/api`：已开启
- `/console`：未开启

这是正确组合：

- API 服务代码保留 `/api`、`/api/admin` 前缀，需透传
- 静态托管不需要透传

### 3. 静态托管 404 根因

访问 `https://tiantiantiyubao.cn/console` 返回：

- `404 Not Found`
- `Code: NoSuchKey`
- `Key: index.html`

这说明：

- `/console` 路由已经命中静态托管
- 但静态托管当前发布结构不对，站点根目录下没有 `index.html`

最常见原因是上传时只传了 `assets.zip`，或者把 `dist` 文件夹整体上传成了：

```text
dist/
  index.html
  assets/
```

而不是正确的：

```text
index.html
assets/
_redirects
```

### 4. 登录 `Failed to fetch` 根因

之前从默认域名访问后台前端时，登录请求出现 CORS error。根因不是账号密码，而是：

- CloudBase 自带跨域处理无法关闭
- `lindong-console-api` 应用层也在返回 CORS 头
- 响应里出现重复头：
  - `access-control-allow-credentials: true,true`
  - `vary: Origin,Origin`

为避免重复头，已从 `lindong-console-api` 移除应用层 CORS 头输出，仅保留 CloudBase 处理。

## 本次已完成代码改动

### 前端配置

已切回自定义域名正式入口方案：

- [console/package.json](/Users/yun/lindong/console/package.json:10)
  - `VITE_APP_BASE=/console/`
- [console/.env.production](/Users/yun/lindong/console/.env.production:1)
  - `VITE_API_BASE_URL=/api/admin`

当前 `console/dist/index.html` 构建产物会引用：

- `/console/assets/...`

这与目标入口 `https://tiantiantiyubao.cn/console` 一致。

### 后端 CORS 调整

已修改：

- [backend/console-api-service/lib/mini-express.js](/Users/yun/lindong/backend/console-api-service/lib/mini-express.js:1)

处理方式：

- 移除 `lindong-console-api` 应用层预检 CORS 头
- 移除应用层正常响应里的 CORS 头
- 让 CloudBase 网关统一处理跨域

回归测试：

- [backend/console-api-service/tests/cors-origin.test.cjs](/Users/yun/lindong/backend/console-api-service/tests/cors-origin.test.cjs:1)

已验证通过：

- `node --test /Users/yun/lindong/backend/console-api-service/tests/cors-origin.test.cjs`
- `node --check /Users/yun/lindong/backend/console-api-service/lib/mini-express.js`

## 仍需完成的线上操作

### A. 重新部署 `lindong-console-api`

因为应用层 CORS 逻辑已改，必须重新部署 `lindong-console-api` 才会生效。

环境变量建议：

- `CONSOLE_ORIGIN`：可留空
- 如果必须填写，填 `https://tiantiantiyubao.cn`
- 不要带 `/console`

### B. 重新发布静态托管

重新构建：

```bash
cd /Users/yun/lindong/console
npm run build
```

正确发布内容必须来自：

- `console/dist` 目录里的内容本身

发布后静态托管根目录第一层应该直接看到：

```text
index.html
assets/
_redirects
```

不要出现：

```text
dist/index.html
dist/assets/
```

也不要只上传：

- `assets.zip`

这会导致 `/console` 继续报 `NoSuchKey: index.html`

### C. 确认 SPA 回退

静态托管需保证：

- 默认文档：`index.html`
- 404/回退文档：`index.html`

否则 React Router 刷新子路由会 404。

## 推荐验证顺序

### 1. 验证后台接口

接口从命令行验证：

```bash
curl -i -X POST 'https://tiantiantiyubao.cn/api/admin/login' \
  -H 'Content-Type: application/json' \
  --data '{"username":"<admin>","password":"<password>"}'
```

预期：

- 返回业务 JSON
- 不再出现重复 CORS 响应头

### 2. 验证前端入口

访问：

- `https://tiantiantiyubao.cn/console`

预期：

- 正常返回后台登录页
- 浏览器 Network 中 JS/CSS 来自 `/console/assets/...`

### 3. 验证登录

必须从这个地址访问后台：

- `https://tiantiantiyubao.cn/console`

不要再从以下地址做正式验证：

- `https://tttiyubao-4g141829bdf6a28d-1304042243.tcloudbaseapp.com/lindong_console/`

因为那会重新回到跨域场景。

登录请求预期：

- 请求地址：`/api/admin/login`
- 页面不再出现 `Failed to fetch`

## 已知风险 / 旁路问题

### 1. `backend/lindong-api/app.js` 存在本地缺失引用

当前文件中有：

- `require('./console-api/routes')`

但仓库里并不存在该目录。这个问题在本轮排查中暴露过，但与当前 `/api/admin` 实际已经独立路由到 `lindong-console-api` 无直接关系。

本轮未处理此问题，避免扩大改动面。

### 2. CloudBase 跨域设置无法关闭

控制台里：

- `/api/admin` 路由的 `Headers 设置` 为空
- 自定义域名级 `Headers 设置` 为空
- 但 CloudBase 的跨域设置仍会生效，且无法直接关闭

因此当前策略是：

- 不再让 `lindong-console-api` 自己输出 CORS 头
- 尽量让正式访问全部走同源：`https://tiantiantiyubao.cn/console` + `/api/admin`

## 下一位接手人最先做什么

1. 重新部署 `lindong-console-api`
2. 用正确结构重新发布静态托管
3. 访问 `https://tiantiantiyubao.cn/console`
4. 如果仍然 404，先检查静态托管根目录第一层是否直接有 `index.html`
5. 如果页面能打开但登录失败，再抓 `/api/admin/login` 的完整响应头继续排查

