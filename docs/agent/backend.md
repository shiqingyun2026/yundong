# Backend Rules

- 后端运行时为 Node.js + Express，当前数据层以 MySQL repository 为主。
- 小程序云托管身份依赖 `x-wx-openid`、`x-wx-appid`、`x-wx-unionid` 等请求头，本地联调时注意 `TRUST_CLOUDBASE_MINIPROGRAM_IDENTITY` 等配置。
- 管理端接口需要管理员 JWT 和权限校验；敏感操作应记录 admin log。
- 业务代码通常按 route/controller/service/repository 分层。新增逻辑优先放在现有职责相近的 service 或 domain 模块，不要把规则塞进 route。
- SQL 迁移和部署手册放在 `docs/sql/`、`docs/deploy/`，改数据库字段时同步检查前后端映射、测试数据和回归用例。
- 后端改动要留意 `backend/lindong-api/` 与 `backend/console-api-service/` 中是否存在共享或镜像代码；同一业务规则可能在小程序 API 和 console API 两处使用。
- 修改 `service`、`shared`、`repository`、`domain` 规则时，应搜索另一侧同名或相近文件，确认是否需要同步修复，或明确说明只改一侧的原因。

关联文档：

- `backend/README.lindong-api.md`
- `docs/sql/`
- `docs/deploy/`
