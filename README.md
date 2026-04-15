# yundong

邻动项目代码仓库。

当前仓库已经迁移到 `yundong`，并采用双分支协作方式：

- `main`：只保留仓库说明文件。
- `preview`：保存完整项目代码，并作为当前实际开发分支。

## 当前仓库结构

- `backend/`：后端服务，包含小程序接口、运营后台接口，以及 Cloudflare Worker 入口。
- `console/`：运营后台前端，基于 React + Vite。
- `miniprogram/`：微信小程序主工程。
- `cloudfunctions/`：微信云函数目录，当前包含 `ip-geolocation`。
- `qa/regression/`：Playwright 回归测试。
- `docs/`：产品、技术、部署、交接和 SQL 文档。
- `frontend/`：独立前端原型或实验工程，非当前主业务入口。

## 分支约定

- 日常开发、联调、提交代码请基于 `preview`。
- `main` 不放业务源码，只用于展示项目说明。
- 如果刚克隆仓库，建议直接切到 `preview`：

```bash
git switch preview
```

也可以直接拉取开发分支：

```bash
git clone -b preview git@github.com:shiqingyun2026/yundong.git
```

## 本地开发

### 后端

目录：`backend/`

安装依赖：

```bash
cd backend
npm install
```

常用命令：

```bash
npm run dev
npm run console:dev
npm run cf:dev
```

说明：

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

### 微信小程序

目录：`miniprogram/`

- 小程序入口：`miniprogram/app.json`
- 微信工程配置：`project.config.json`
- 当前配置了 `miniprogramRoot: "./miniprogram"`
- 当前配置了 `cloudfunctionRoot: "cloudfunctions/"`

使用微信开发者工具时，可以直接打开仓库根目录，它会按 `project.config.json` 自动指向小程序和云函数目录。

### 回归测试

目录：`qa/regression/`

```bash
cd qa/regression
npm install
npm test
```

常用附加命令：

```bash
npm run test:headed
npm run test:console-live
npm run test:console-prod
```

## 环境变量与敏感信息

- 示例配置优先参考各目录下的 `.env.example`。
- 本地私有配置不要提交到仓库。
- `backend/.env.save` 和 `cloudfunctions/ip-geolocation/.env` 已被加入忽略规则，不应再纳入版本管理。

## 协作说明

- 小程序相关代码统一放在 `miniprogram/`。
- 新增文档优先放到 `docs/` 并按主题拆分。
- `frontend/` 当前仅作为独立原型目录使用，如后续废弃，建议单独清理或在文档中进一步标明用途。
