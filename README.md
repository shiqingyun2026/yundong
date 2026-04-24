# yundong

## 当前仓库结构

- `miniprogram/`：微信小程序主工程，当前主业务入口。
- `backend/`：后端服务，包含小程序接口、运营后台接口，以及 Cloudflare Worker 入口。
- `console/`：运营后台前端。
- `cloudfunctions/`：微信云函数目录，当前包含 `ip-geolocation`。
- `qa/regression/`：Playwright 回归测试。
- `docs/`：部署、交接、SQL、产品和技术文档。
- `frontend/`：独立前端原型或实验工程，非当前主业务入口。
- `docs/console/邻动体适能运营后台/`：文档型原型工程，非当前正式后台入口。

## 技术栈

- 小程序：微信原生小程序，`WXML + WXSS + JavaScript`，使用 `style: v2`、`glass-easel`、`lazyCodeLoading`。
- 小程序 UI：基于 `weui-miniprogram` 官方组件与官方样式语义，图标资产由 `weui-miniprogram/icon` 官方数据构建生成。
- 后端：`Node.js + Express + JWT + MySQL`，当前保留部分 `Supabase` 迁移痕迹，并维护 `Cloudflare Worker / Wrangler` 入口。
- 运营后台：`React 19 + TypeScript + Vite 6 + React Router 7 + Semi Icons`。
- 回归测试：`Playwright`。
- 微信云能力：微信云函数 `ip-geolocation`。

## 本地开发

### 后端

目录：`backend/`

```bash
cd backend
npm install
npm run dev
```

常用命令：

```bash
npm run console:dev
npm run cf:dev
```

- `npm run dev`：启动当前 Node 后端入口。
- `npm run console:dev`：启动运营后台接口服务。
- `npm run cf:dev`：本地运行 Cloudflare Worker 版本。

### 运营后台前端

目录：`console/`

```bash
cd console
npm install
npm run dev
```

默认开发端口为 `3100`。

生产发布当前建议使用 CloudBase 静态托管：

```bash
cd console
npm run lint
npm run build:cloudbase
```

发布产物目录为 `console/dist`。

### 微信小程序

目录：`miniprogram/`

- 小程序入口：[miniprogram/app.json](/Users/justin/Developer/yundong/miniprogram/app.json:1)
- 微信工程配置：[project.config.json](/Users/justin/Developer/yundong/project.config.json:1)
- 根级工程配置已声明 `miniprogramRoot: "./miniprogram"` 和 `cloudfunctionRoot: "cloudfunctions/"`

首次同步依赖或更新图标/Vendor 资源时，建议执行：

```bash
cd miniprogram
npm install
npm run weui:sync
npm run icons:build
```

使用微信开发者工具时，直接打开仓库根目录即可，它会按根级 `project.config.json` 自动指向小程序和云函数目录。

### 回归测试

自动化测试说明、覆盖范围、执行命令、live/prod 前置条件，请查看：

- [qa/regression/README.md](/Users/yun/lindong/qa/regression/README.md)

最基础的本地 Playwright 回归入口仍然是 `qa/regression/`：

```bash
cd qa/regression
npm install
npx playwright install chromium
npm test
```

## 开发约束

- 小程序页面层优先使用 `weui-miniprogram` 官方组件和官方样式语义，不在页面里重复堆平行的自定义基础组件。
- 图标统一走 `weui-miniprogram/icon` 官方数据和生成链路；品牌色、状态色、阴影、渐变统一从主题 token 改，不在页面里散写主品牌色。
- 不手改生成产物，例如小程序图标资产、`tabBar` 图标、图标注册表；相关改动后统一执行对应脚本重建。
- 小程序组件优先局部注册，保持 `lazyCodeLoading` 的收益；全局组件只在确有必要时引入。
- `frontend/` 和 `docs/console/邻动体适能运营后台/` 属于原型/文档工程，非当前主业务入口；正式实现优先以 `miniprogram/`、`backend/`、`console/` 为准。

## 提交前验证

- 小程序 UI / 图标 / 主题改动：

```bash
cd miniprogram
npm run icons:build
```

- 运营后台改动：

```bash
cd console
npm run lint
npm run build:cloudbase
```

- 后端改动：运行对应 `verify:*` 或 smoke 命令。
- 需要回归时：按 [qa/regression/README.md](/Users/justin/Developer/yundong/qa/regression/README.md:1) 执行 Playwright 用例。
