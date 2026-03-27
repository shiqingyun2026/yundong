# lindong

邻动项目代码仓库，当前按职责拆分为后端、运营后台前端、微信小程序前端、测试和文档几个部分。

## 目录说明

- `backend/`: Node.js + Express 后端服务。
- `console/`: 运营后台前端，基于 React + Vite。
- `miniprogram/`: 微信小程序主工程。
- `docs/`: 产品、技术、交接和 SQL 文档。
- `qa/`: 测试相关内容，当前主要是 Playwright 回归测试。
- `frontend/`: 另一套独立的 React/Vite 前端原型或实验工程，不属于当前微信小程序主工程。

## 当前主工程入口

### 微信小程序

小程序代码已经统一收敛到 `miniprogram/` 目录。

- 小程序代码入口：`miniprogram/app.json`
- 微信工程配置：`project.config.json`
- 当前已配置 `miniprogramRoot: "miniprogram/"`

使用微信开发者工具时，可以直接打开仓库根目录 `/Users/yun/lindong`，工具会自动按 `project.config.json` 指向 `miniprogram/`。

### 后端

后端目录：`backend/`

常用命令：

```bash
cd backend
npm install
npm run dev
```

### 运营后台前端

运营后台目录：`console/`

常用命令：

```bash
cd console
npm install
npm run dev
```

默认开发端口为 `3100`。

### 回归测试

回归测试目录：`qa/regression/`

常用命令：

```bash
cd qa/regression
npm install
npm test
```

## 协作约定

- 小程序相关代码统一放在 `miniprogram/` 下，不再放在仓库根目录。
- 新增文档优先放到 `docs/` 下，并按主题继续拆分子目录。
- 如果 `frontend/` 后续确认废弃，建议单独清理或在文档中明确用途，避免和 `console/`、`miniprogram/` 混淆。
