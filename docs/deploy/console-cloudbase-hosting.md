# Console 前端迁移到 CloudBase 静态托管

更新时间：2026-04-20

## 1. 目标

将运营后台前端从“任意静态托管/Vercel 经验方案”收口为 CloudBase 静态托管统一发布。

适用目录：

- [console](/Users/yun/lindong/console)

不包含：

- 小程序云托管后端 `lindong-api`
- `backend/console-api` 服务端接口

## 2. 当前推荐发布形态

后台前端：

- CloudBase 静态托管

后台接口：

- 建议同步迁到 CloudBase 云托管
- 当前建议直接指向：
  - `https://<console-api-cloudbase-domain>/api/admin`
- 后台上传图片默认 provider 现已建议为 `cos`

对应文件：

- [console/.env.production](/Users/yun/lindong/console/.env.production)

## 3. 发布前本地校验

在 [console](/Users/yun/lindong/console) 下执行：

```bash
npm install
npm run lint
npm run build:cloudbase
```

通过标准：

- `lint` 无报错
- `build:cloudbase` 成功
- 生成产物目录 [console/dist](/Users/yun/lindong/console/dist)

## 4. CloudBase 控制台建议配置

如果使用 CloudBase 静态托管控制台在线构建，建议填写：

- Root Directory：`console`
- Build Command：`npm install && npm run build:cloudbase`
- Output Directory：`dist`

如果使用本地上传方式，则直接上传：

- [console/dist](/Users/yun/lindong/console/dist)

环境变量至少需要：

- `VITE_API_BASE_URL`

建议值：

- `https://<console-api-cloudbase-domain>/api/admin`

## 5. SPA 路由配置

运营后台使用 React Router。

因此在 CloudBase 静态托管里必须处理“刷新子路由 404”问题，建议：

- 默认首页文档：`index.html`
- 错误文档或回退文档：`index.html`

如果不配这一步，访问下面这些地址再刷新时会直接 404：

- `/dashboard`
- `/packages`
- `/package-groups`
- `/package-orders`

## 6. 发布后验证

建议按下面顺序检查：

1. 打开后台登录页，确认静态资源正常加载。
2. 登录后台，确认 `POST /api/admin/login` 正常。
3. 打开 dashboard，确认首页数据正常。
4. 打开课包列表，确认能看到“课包类型”。
5. 新建课包，确认“课包类型”为必填。
6. 直接刷新 `/packages`、`/package-orders` 等子路由，确认不会 404。

## 7. 迁移注意事项

1. CloudBase 静态托管只迁移后台前端，不替代服务端接口；Console 接口建议单独迁到 CloudBase 云托管。
2. 小程序真机调用的仍是 `wx.cloud.callContainer -> lindong-api`，不要和 console 的发布路径混用。
3. 如果后台页面没更新，优先检查静态托管是否重新发布。
4. 如果后台接口行为没更新，优先检查接口服务本身，而不是静态托管。
