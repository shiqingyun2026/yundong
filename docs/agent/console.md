# Console Rules

- 正式后台前端位于 `console/`，使用 React 19、TypeScript、Vite 6、React Router 7、Semi Icons。
- 本地默认前端地址为 `http://127.0.0.1:3100`。
- 综合后端默认 `http://127.0.0.1:8000`，独立 console-api 常用 `http://127.0.0.1:8100`。
- 前端直连独立 console-api 时，在 `console/.env` 设置 `VITE_API_BASE_URL=http://127.0.0.1:8100/api/admin`。
- 发布前至少运行 `npm run lint` 和 `npm run build:cloudbase`。
- React Router 子路由部署到 CloudBase 静态托管时，需要 `_redirects` 或控制台回退到 `index.html`。

关联文档：

- `console/README.md`
