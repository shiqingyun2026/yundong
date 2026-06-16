# AGENTS.md

本文件面向在本仓库工作的 AI 编程助手。开始改动前，先读本文件，再读相关目录 README，并只按当前任务范围补充阅读必要文档。

## Project Structure

- 正式业务主入口：`miniprogram/`、`backend/`、`console/`
- 小程序后端真源：`backend/lindong-api/`
- 运营后台 API 真源：`backend/console-api-service/`
- 回归测试：`qa/regression/`
- 云函数：`cloudfunctions/`
- 文档与 SQL：`docs/`、`docs/sql/`
- 历史/文档型目录不要误当主入口：`docs/console/邻动体适能运营后台/`

当前主链路口径：微信原生小程序 + Node.js/Express 后端 + CloudBase 云托管微信身份头 + MySQL 数据层。改动时以 `README.md`、`docs/miniprogram/tech.md` 和实际代码为准。

## Current Stack

- 小程序：原生 `WXML + WXSS + JavaScript`
- 小程序 UI：`weui-miniprogram`
- 后端：`Node.js + Express + JWT + MySQL`
- 运营后台：`React 19 + TypeScript + Vite 6 + React Router 7`
- 回归：`Playwright`

## Default Working Style

- 优先简单可工作的方案，不做任务范围外功能，不做预防式抽象。
- 只做当前任务必须的改动，不顺手重构无关代码，不改无关格式、命名、注释。
- 修改前先读相关 exports、callers、shared utilities，理解结构后再写；如果结构仍不明确，应停下来确认。
- 涉及 shared services、镜像实现、重复业务规则时，先检查另一侧是否也受影响。
- 先定义成功标准，再做与改动范围匹配的最小验证。
- 不隐瞒未验证项、失败项、假设、限制和不确定区域。
- 优先遵循仓库既有模式，一致性高于个人偏好。

## Development Rules

- 开始和结束前都看 `git status --short`，避免覆盖用户已有改动。
- 不要手改生成产物，尤其是小程序图标资产、`tabBar` 图标、自动生成注册表；应修改源文件后运行生成脚本。
- `console/dist/` 是构建产物；除非任务明确要求，否则不要直接改，也不要把它作为主修改目标。
- 环境变量、密钥、生产账号、支付证书等敏感信息不得写入代码或文档。
- 涉及数据库变更时，默认按用户在腾讯云 DMS / SQL 窗口中手动执行的方式提供操作指引，而不是优先提供 terminal 命令；说明顺序应为：先确认当前库名与环境，再给执行前检查 SQL，再给正式 migration SQL，再给执行后回查 SQL。除非用户明确要求，否则不要默认代替用户直接执行生产或测试环境数据库变更。
- 未指定数据库时，默认测试环境数据库为 `tiyubao-pre`；提供给用户的 SQL 语句应默认以 `USE \`tiyubao-pre\`;` 开头，避免出现 `No database selected`。
- 详细模块规范与命令索引见：
  - `docs/agent/miniprogram.md`
  - `docs/agent/console.md`
  - `docs/agent/backend.md`

## High Risk Areas

- 支付、退款、订单状态、拼团状态、微信身份、账号归并、权限、数据迁移属于高风险。
- 修改前必须读相关 `service`、`repository`、测试和部署文档，再做小范围、可验证的修改。
- 涉及敏感管理操作时，应保留权限校验与 admin log 约束。

## Bug Investigation

- 先基于本地代码、日志、测试和可复现现象验证，再判断根因；不要直接猜测或贸然改代码。
- 如果缺少关键上下文且无法继续有效验证，应明确说明缺失信息再请用户补充。
- 优先补充的信息包括：复现步骤、期望结果、实际结果、报错日志或截图、页面/账号/环境、最近配置或数据变更。

## Postmortem Guidance

- 遇到以下重大问题时，应主动建议记录 postmortem：
  - 生产故障
  - 支付/退款异常
  - 订单或账号异常
  - 权限问题
  - 数据污染或丢失
  - 部署回滚
  - 影响真实用户的阻断问题
  - 重复出现但根因不清的问题
- 新增或修改复盘文档前，先征得用户确认。
- 位置：`docs/Postmortem
- 建议文件名：

```txt
YYYY-MM-DD-event-name-postmortem.md
```

## Shared Backend Rules

- 后端双侧实现要同时留意：`backend/lindong-api/`、`backend/console-api-service/`
- 同一业务规则可能以 duplicated、mirrored 或 shared 的形式同时存在。
- 修改 `services`、`repositories`、`domain rules`、`shared modules` 时，必须检查另一侧是否需要同步修改。
- 如果只改单边，必须明确说明原因。

## High Context Files

- `miniprogram/utils/course.js`
- `miniprogram/pages/course/detail/index.js`
- `console/src/pages/CourseFormPage.tsx`
- `backend/console-api-service/console-api/services/coursesService.js`
- `backend/console-api-service/shared/services/groupOrders.js`
- `backend/lindong-api/shared/services/groupOrders.js`

涉及这些文件时，优先小范围修改，避免顺手做大规模重构。

## Important Docs

- `README.md`
- `docs/miniprogram/tech.md`
- `docs/ui-agent.md`
- `backend/README.lindong-api.md`
- `console/README.md`
- `qa/regression/README.md`
- `docs/deploy/`
- `docs/sql/`
- `docs/agent/miniprogram.md`
- `docs/agent/console.md`
- `docs/agent/backend.md`
