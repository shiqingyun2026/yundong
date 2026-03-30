# 小程序 API 云托管部署复盘

## 1. 背景

本文档用于记录 2026-03-30 这轮“小程序 API 切到微信云开发 / 云托管，console 保持现状”过程中踩到的坑、最终收敛出的方案，以及后续继续部署时应直接复用的经验。

本轮真实路径不是一次到位，而是经历了：

* `Vercel`
* `Cloudflare Workers`
* `wx.cloud.callFunction -> 云函数代理外部服务`
* `wx.cloud.callContainer -> 云托管服务`

最终真正稳定跑通的是最后一种。


## 2. 这轮最终成功的形态

当前建议保持如下架构：

* 小程序：`wx.cloud.callContainer -> 云托管服务 lindong-api`
* console：继续走标准 HTTP 服务，不依赖微信专用链路
* 两端继续共用同一套业务规则和同一套主数据

这轮代码落点主要是：

* 小程序请求层增加 `container` transport：
  * [miniprogram/config/env.js](/Users/yun/lindong/miniprogram/config/env.js)
  * [miniprogram/app.js](/Users/yun/lindong/miniprogram/app.js)
  * [miniprogram/utils/request.js](/Users/yun/lindong/miniprogram/utils/request.js)
* 后端拆出“小程序专用云托管入口”：
  * [backend/miniprogram-container/app.js](/Users/yun/lindong/backend/miniprogram-container/app.js)
  * [backend/miniprogram-container/server.js](/Users/yun/lindong/backend/miniprogram-container/server.js)
  * [backend/package.json](/Users/yun/lindong/backend/package.json)
* 云托管部署镜像配置：
  * [backend/Dockerfile](/Users/yun/lindong/backend/Dockerfile)
  * [backend/.dockerignore](/Users/yun/lindong/backend/.dockerignore)


## 3. 为什么前面几条路没有收住

### 3.1 Vercel / Cloudflare 适合普通 HTTP，不适合当前这轮小程序云开发切流目标

Vercel 和 Cloudflare 本身不是“错”，但它们对应的是：

* 浏览器 / 小程序通过公网 HTTP 域名访问
* 需要处理外部域名、回源、网络链路和平台兼容性

如果目标已经明确是“让小程序走微信云开发专用链路”，那这两条路并不直接解决问题，只会让部署形态和联调入口继续混在一起。


### 3.2 `callFunction -> 云函数代理外部 Workers` 不是完整内网链路

这轮最关键的认知修正是：

* `wx.cloud.callFunction` 只保证“小程序 -> 云函数”走微信云开发链路
* 但“云函数 -> Cloudflare Workers”仍然是云函数主动访问外部网络

我们实际排查到的现象是：

* 云函数可以正常被调用
* DNS 解析成功
* 但 TCP / TLS 建连阶段一直卡住
* 最终只能以 `ETIMEDOUT` / 平台超时结束

因此，这条方案在当前环境下不适合作为开发环境主链路。


### 3.3 项目根目录一开始导错，导致云函数目录根本没被识别

最开始微信开发者工具导入的是 `miniprogram/` 子目录，而不是仓库根目录。

结果：

* 工具看不到仓库根下的 `backend/`
* `cloudfunctionRoot` 配置不生效
* 误以为是“云函数代码问题”，实际是“项目根目录不对”

**经验**：
只要项目需要同时使用 `miniprogramRoot` 和 `cloudfunctionRoot`，微信开发者工具就必须导入仓库根目录，而不是只导入小程序子目录。


### 3.4 云托管代码包不能直接拿整个仓库上传

如果直接把整个 `lindong/` 仓库打包上传，会带来几个问题：

* 代码包过大
* `Dockerfile` 路径容易错
* console、小程序、文档、测试全混在一起
* 启动入口不清晰

这轮最终采用的是“只上传 `backend` 的最小可部署集合”：

* `Dockerfile`
* `.dockerignore`
* `package.json`
* `package-lock.json`
* `lib/`
* `middleware/`
* `miniprogram-container/`
* `routes/`
* `shared/`
* `utils/`


### 3.5 构建失败不一定是平台问题，很多时候是 `Dockerfile + package-lock` 的组合问题

这轮第一次云托管构建失败，不是页面填写错误，而是：

* `Dockerfile` 里用了 `npm ci --omit=dev`
* 当前 `package.json` 和 `package-lock.json` 根依赖不同步
* `wrangler` 在 `package.json` 里，但锁文件根依赖里没有
* Docker 构建阶段被 `npm ci` 严格模式拦下

这轮最终修复：

* 把 `Dockerfile` 改成 `npm install --omit=dev`
* 把 `wrangler` 移到 `devDependencies`

**经验**：
云托管源码部署时，构建失败先看 Docker 日志里的失败层，不要先怀疑平台本身。


## 4. 本轮沉淀出的经验

### 4.1 小程序如果要走微信内部链路，优先考虑 `callContainer`

对当前项目而言，更匹配的不是“云函数代理外部服务”，而是：

* 小程序直接 `wx.cloud.callContainer`
* 服务直接部署在同一云开发环境的云托管里

这样可以：

* 避开外部公网链路
* 不依赖 Cloudflare / Vercel 的额外网络稳定性
* 不需要给小程序再配额外请求域名


### 4.2 小程序入口和 console 入口必须继续拆开

这轮证明了一个架构结论：

* 小程序可以走微信专用链路
* console 仍然是普通 Web，必须继续走标准 HTTP

如果强行让 console 也依赖 `callContainer`，反而会把边界搞乱。

**当前建议长期保持**：

* 小程序：云托管 / 微信云开发入口
* console：标准 HTTP 服务入口


### 4.3 先收敛最小可部署单元，再做平台部署

平台页面里的每一个配置项，最终都要落到“代码包根目录到底有什么”这个问题上。

如果最小可部署单元没先收住，后面会反复出现：

* Dockerfile 路径不对
* 启动命令不对
* 依赖范围过大
* 入口混杂

因此后续继续加部署平台时，都建议先问清楚：

* 这次到底部署哪个服务
* 这个服务的最小运行目录是什么
* 它和 console / 测试 / 云函数是否解耦


### 4.4 日志必须做到“能分阶段定位”

这轮云函数代理阶段真正把问题定位清楚，不是靠猜，而是靠逐层加日志：

* invoke
* proxy request start
* dns lookup
* tcp connect
* tls secure connect
* proxy request failed

**经验**：
只要链路跨平台、跨网络，就不要只打“开始/失败”两条日志，至少要把 DNS、建连、响应三个阶段拆开。


### 4.5 文档要及时跟着真实路线更新

这轮前半段文档里仍然在围绕“云函数网关切流”组织步骤，但实际最终落地成了“云托管 + callContainer”。

**经验**：
当部署路线发生根本变化时，应该及时新增专项复盘文档，避免后续接手者继续沿旧路线踩坑。


## 5. 后续继续部署时的建议顺序

### 5.1 小程序 API

建议继续保持：

1. 代码只维护 `backend/miniprogram-container`
2. 云托管服务名固定为 `lindong-api`
3. 小程序 `develop` 继续走 `container`
4. 读链路稳定后再继续验证：
   * `POST /api/auth/login`
   * `POST /api/orders`
   * `POST /api/payments/mock-success`


### 5.2 console

建议继续保持：

1. console 不接入 `callContainer`
2. console 仍通过标准 HTTP API 访问后台
3. console 后续部署和域名配置单独管理，不和小程序这条链路混用


## 6. 当前可直接复用的部署参数

### 6.1 云托管服务

建议值：

* 服务名：`lindong-api`
* 端口：`8000`
* Dockerfile 路径：`Dockerfile`
* 启动命令：`npm run miniprogram-container:start`（仅在平台不直接读 Dockerfile 时使用）

### 6.2 环境变量

至少需要：

* `SUPABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`
* `JWT_SECRET`

### 6.3 上传包

不要压整个仓库，应该只上传云托管需要的后端最小代码包。

### 6.4 当前验证状态

截至 2026-03-30，已经完成两层验证：

* 服务级联调通过：
  * 读链路
  * `login`
  * `create order`
  * `mock success`
* 小程序页面级联调通过：
  * 首页
  * 课程详情
  * 登录
  * 支付确认
  * 支付结果
  * 我的拼团

### 6.5 仓库已做的清理

在确认 `callContainer -> lindong-api` 稳定后，仓库里已经移除旧的云函数试错残留：

* `cloudfunctions/miniProgramGateway`
* `backend/miniprogram-cloud/`
* 小程序请求层中的 `callFunction` 旧 transport
* 微信开发者工具配置里的 `cloudfunctionRoot`

## 7. 一句话总结

本轮最重要的经验是：

**小程序如果目标是走微信内部专用链路，就不要让云函数再去代理外部 HTTP 服务；直接用 `wx.cloud.callContainer -> 云托管服务`，同时保持 console 继续走标准 HTTP，才是当前项目最稳的收敛方式。**
