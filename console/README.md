# 邻动体适能运营后台

## 开发

1. 安装依赖：`npm install`
2. 复制 `.env.example` 为 `.env`
3. 启动前端：`npm run dev`
4. 启动后端：
   - 综合后端联调：在 `backend/` 下执行 `npm run dev`
   - 独立 console-api 联调：在 `backend/` 下执行 `CONSOLE_API_PORT=8100 npm run console:dev`

默认开发地址：

* 前端：`http://127.0.0.1:3100`
* 综合后端：`http://127.0.0.1:8000`
* 独立 console-api：`http://127.0.0.1:8100`

默认开发登录账号来自 `backend/.env.example` 中的 bootstrap 管理员配置：

* 用户名：`admin`
* 密码：`admin123456`

说明：

1. 当前版本为项目骨架。
2. 课程列表、课程编辑、订单列表、账号列表已接入 `/api/admin/*` 基础路由。
3. 退款、上传签名、管理员持久化账号仍待数据库迁移完成后再补齐。
4. 如果前端要直连独立 `console-api`，请在 `console/.env` 中把 `VITE_API_BASE_URL` 配成 `http://127.0.0.1:8100/api/admin`。
5. 可用 `cd /Users/yun/lindong/qa/regression && npm run test:console-live` 验证“前端 + 独立 console-api”本地真实登录与 dashboard 联调。
