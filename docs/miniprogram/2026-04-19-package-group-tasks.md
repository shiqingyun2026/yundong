# 2026-04-19 课包拼团 V2.2 开发任务清单

## 1. 文档目标

本文档用于把课包拼团 V2.2 第一阶段与第二阶段的开发任务拆成可执行清单，支持排期、分工与验收。

相关文档：

- [prd2.0md.md](/Users/yun/lindong/docs/miniprogram/prd2.0md.md)
- [2026-04-19-package-group-tech-design.md](/Users/yun/lindong/docs/miniprogram/2026-04-19-package-group-tech-design.md)
- [2026-04-19-package-group-api.md](/Users/yun/lindong/docs/miniprogram/2026-04-19-package-group-api.md)

## 2. 分期说明

## 2.1 第一期目标

打通“课包拼团主链路”：

- 课包管理
- 小程序课包主链路
- 课包拼团下单、mock 支付、成团、失败退款
- 后台课包订单和拼团查看

## 2.2 第二期目标

补齐支付、通知、运营增强：

- 真支付
- 真退款
- 真通知
- 统计和筛选增强

## 2.3 当前进度（截至 2026-04-19）

- 当前已完成第一批后端落地：
  - A1 ~ A3 数据层
  - B1 ~ B3 Repository 层
  - C3 课包订单主链路第一版
  - D1 ~ D3 小程序 API 主链路第一版
  - E1 ~ E3 后台 API 第一版
- 当前部分完成：
  - C1 已落地规则与排期代码，但还没有补齐单元测试
  - C2 已打通小程序读取服务；后台 API 目前复用底层 repository 和少量格式化工具，完整后台读取抽象仍可继续优化
  - C4 已有被动清理和 internal route 主动清理入口，自动失败退款会同步 `orders` 与 `payment_records`；真实定时调度配置仍待部署侧接入
- 当前未开始：
  - F 小程序前端
  - G 后台前端
  - H 真环境 smoke
  - 第二期全部任务

已完成的代码验证：

- `backend/app.js` 可正常加载
- 课包相关 shared service 可正常加载
- 现有 `backend/tests/miniprogram-routes.mysql.test.js` smoke 已通过
- 新增 `backend/tests/package-group-admin.test.js` 已通过，覆盖后台课包 API 路由挂载、后台手动退款、成团退款拦截、失败团自动退款同步
- `backend/tests/console-api.mysql-routes.test.js`、`backend/tests/console-api.mysql-services.test.js` 已通过

当前交接风险：

- 新 migration 还未在真实 CloudBase SQL / MySQL 执行验证
- `packageReaders` 当前返回结构偏小程序，后台复用抽象还可继续优化
- 自动失败退款已接入内部管理入口，但还未配置真实定时触发任务
- `GET /api/package-groups/:id` 当前实现要求登录鉴权
- 真实小程序云托管当前以 [deploy-artifacts/lindong-api-deploy](/Users/yun/lindong/deploy-artifacts/lindong-api-deploy) 作为实际部署包；如果只改 `backend/` 而没有同步并重新部署该目录，真机看到的仍会是旧版本代码

## 3. 第一期任务清单

### A. 数据层

#### A1 新增表结构迁移

状态：已完成。SQL 已落地，待真实 CloudBase SQL / MySQL 执行验证。

- 新建 `course_packages`
- 新建 `package_groups`
- 扩展 `orders`
- 扩展 `payment_records`

验收：

- MySQL migration 可在 CloudBase SQL / 本地 MySQL 执行
- 不破坏现有单次课程表

#### A2 索引与唯一性约束

状态：已完成。索引和 pending 唯一性已在第一版 schema / migration 中补齐，待真实库验证。

- 增加 `course_packages.status`
- 增加 `package_groups.package_id + status + deadline`
- 增加 `orders.pending_user_package_key`
- 增加 `orders.package_group_id + status`

验收：

- 同用户同课包 pending 单唯一性生效
- 课包团查询和订单查询索引齐全

#### A3 回归种子数据

状态：已完成。已新增课包模式 seed，待真实环境执行回归。

- 新增课包模式种子数据
- 生成：
  - 一个可开团课包
  - 一个进行中团
  - 一个已成团团
  - 一个已失败团
  - 一个“同一课包下已有 3 个进行中团”的首页/详情验证场景

相关 CloudBase SQL：

- [cloudbase_package_group_05_seed_home_packages.sql](/Users/yun/lindong/backend/migrations/cloudbase_package_group_05_seed_home_packages.sql)
- [cloudbase_package_group_06_seed_three_active_groups.sql](/Users/yun/lindong/backend/migrations/cloudbase_package_group_06_seed_three_active_groups.sql)

验收：

- 本地和测试环境可快速复位课包回归数据

### B. Repository 层

#### B1 新增课包 Repository

状态：已完成。课包与课包团 Repository 已落地。

- `coursePackagesRepository`
- `packageGroupsRepository`

验收：

- 支持 CRUD 与主查询场景

#### B2 扩展订单 Repository

状态：已完成。订单仓库已支持课包字段、pending 查询和团订单查询。

- `ordersRepository` 增加课包字段支持
- pending 课包订单查询
- 课包团订单查询

验收：

- 新旧订单模式能并存查询

#### B3 扩展支付记录 Repository

状态：已完成。已支持课包订单支付记录扩展；退款态仍待后续补齐。

- `paymentRecordsRepository` 支持课包订单

验收：

- mock-success 后支付记录可正确写入和更新

### C. 共享业务层

#### C1 新增课包规则层

状态：部分完成。规则层和排期服务已落地，但“规则层具备单元测试”这一验收项未完成。

- `packageGroupRules`
- `packageSchedule`

覆盖规则：

- 48 小时截止
- 成团锁定首课时间
- 5 次课时间生成

验收：

- 规则层具备单元测试

#### C2 新增课包读取服务

状态：部分完成。已支持小程序首页 / 详情 / 进行中团 / 我的拼团读取；后台复用尚未落地。

- `packageReaders`

覆盖：

- 首页课包卡片
- 课包详情
- 进行中团列表
- 我的课包拼团列表

验收：

- 小程序和后台都能复用

#### C3 新增课包订单服务

状态：已完成第一版。已打通开团 / 参团下单、重复参与校验、支付成功后的建团 / 入团与成团更新。

- `packageOrders`

覆盖：

- 开团下单
- 参团下单
- 重复参与校验
- 支付成功后的团创建/入团
- 成团状态更新

验收：

- 不提前生成空团
- 订单成功后人数正确增长

补充说明：

- 当前实现中 `start` 订单不会提前生成空团，而是在支付成功后创建真实 `package_group`
- 课包成员当前由 `orders(order_type=2, package_group_id=?, status='success')` 推导，不单独建成员表

#### C4 自动失败退款服务

状态：已完成第一版。已实现被动清理、internal route 主动清理入口，并同步 `orders` 与 `payment_records` 退款态；真实定时调度配置仍待部署侧接入。

- 定时扫描 `package_groups`
- 失败团退款
- 状态同步

验收：

- 到期未成团可自动退款

补充说明：

- 新增 `GET/POST /api/internal/package-groups/cleanup-expired`，沿用 `CRON_SECRET` 鉴权
- `cleanupExpiredPackageGroups` 会将到期 active 团置为 `failed`，关闭 pending 订单，并把 success 订单与对应 `payment_records` 更新为退款态

### D. 小程序 API 路由

#### D1 新增课包路由

状态：已完成第一版。主读接口已接入小程序后端。

- `GET /api/packages`
- `GET /api/packages/:id`
- `GET /api/package-groups/:id`
- `GET /api/user/package-groups`

验收：

- 返回字段与 API 文档一致

补充说明：

- 当前 `GET /api/package-groups/:id` 实现要求登录鉴权，如需对齐更宽松访问策略需再确认

#### D2 新增课包订单路由

状态：已完成第一版。已支持创建 `start` / `join` 待支付订单与重复参与限制。

- `POST /api/package-orders/start`
- `POST /api/package-orders/join`

验收：

- 可创建待支付订单
- 重复参与限制生效

#### D3 扩展 mock 支付成功

状态：已完成第一版。`mock-success` 已能识别课包订单并走课包支付成功链路。

- `POST /api/payments/mock-success`

验收：

- `start` 单支付成功后创建团
- `join` 单支付成功后加入团
- 满团后自动成团

### E. 后台 API 路由

#### E1 课包管理接口

状态：已完成第一版。

- `GET /api/admin/packages`
- `GET /api/admin/packages/:id`
- `POST /api/admin/packages`
- `PUT /api/admin/packages/:id`

验收：

- 后台可创建和编辑课包

补充说明：

- 新增后台课包 service/controller/routes，接口挂载在 `console-api`
- 第一版仅支持 MySQL repository 模式；非 MySQL 模式返回 501
- 写入字段按 API 文档使用 `total_price_fen`、`status=active/inactive`，底层映射到 `course_packages.total_price/status`

#### E2 课包拼团接口

状态：已完成第一版。

- `GET /api/admin/package-groups`

验收：

- 可按状态、课包查看拼团

补充说明：

- 支持 `package_id`、`status`、`page`、`size`
- 列表读取前会触发一次到期团清理，确保后台看到的团状态尽量新鲜

#### E3 课包订单接口

状态：已完成第一版。

- `GET /api/admin/package-orders`
- `POST /api/admin/package-orders/:id/refund`

验收：

- 后台可查看并发起退款

补充说明：

- 支持 `keyword`、`status`、`package_id`、`page`、`size`
- 手动退款仅允许课包 `success` 订单；已成团团不支持个人线上退款
- 手动退款会同步 `orders` 与 `payment_records`，并在 active 团人数归零时将团置为 `failed` 且关闭 pending 单

### F. 小程序前端

#### F1 首页改造

状态：未开始。

- 课程首页改为课包首页
- 卡片改为课包字段
- 仅显示最大人数人均价

验收：

- 不再展示旧单次课程主入口

#### F2 课包详情页

状态：未开始。

- 展示课包信息
- 展示进行中团列表
- 不展示团长昵称

验收：

- 时间文案为“每周X HH:00，共5次”

#### F3 开团页

状态：未开始。

- 选择目标人数
- 选择星期
- 选择整点
- 展示预估支付金额

验收：

- 不选具体日期

#### F4 参团页

状态：未开始。

- 展示团信息
- 支付确认

验收：

- 可从详情页进入并完成参团下单

#### F5 拼团详情页

状态：未开始。

- 进行中显示抽象时间文案
- 成团后显示 5 次具体课时
- 显示成员列表

验收：

- 状态切换正确

#### F6 我的拼团

状态：未开始。

- 适配课包字段
- 全部 / 进行中 / 已成团 / 已失败

验收：

- 列表与详情跳转正常

### G. 后台前端

#### G1 菜单与入口调整

状态：未开始。

- 第一版隐藏旧单次课程入口
- 只保留课包主流程入口

验收：

- 后台默认工作台进入课包模式

#### G2 课包管理页

状态：未开始。

- 列表
- 新增
- 编辑

验收：

- 表单字段与 PRD 一致

#### G3 课包拼团页

状态：未开始。

- 拼团列表
- 状态筛选

验收：

- 可监控进行中/成功/失败团

#### G4 课包订单页

状态：未开始。

- 订单列表
- 手动退款

验收：

- 可查看支付金额与订单状态

### H. 测试与回归

#### H1 单元测试

状态：部分完成。已新增规则层与后台退款专项测试；`packageOrders` 的重复参与与支付成功状态流转纯单元测试仍待继续补齐。

- schedule 计算
- 重复参与规则
- 成团状态流转
- 失败退款

补充说明：

- `backend/tests/package-group-admin.test.js` 覆盖后台手动退款、成团退款拦截、失败团自动退款同步 `payment_records`
- `backend/tests/package-group-rules.test.js` 覆盖 `packageGroupRules` 与 `packageSchedule` 的金额、状态、截止时间、首课时间和 5 周排期计算

#### H2 API 集成测试

状态：部分完成。现有小程序 MySQL route smoke 可通过，已新增后台课包 API 路由挂载测试，并补齐小程序课包接口与课包 `mock-success` 分支 smoke；基于真实 repository 的更深主链路集成测试仍可继续补齐。

- 小程序课包接口
- 后台课包接口
- mock-success 主链路

补充说明：

- `backend/tests/package-group-admin.test.js` 覆盖 `/api/admin/packages`、`/api/admin/package-groups`、`/api/admin/package-orders` 路由挂载与鉴权
- `backend/tests/miniprogram-routes.mysql.test.js` 已覆盖 `/api/packages`、`/api/package-groups/:id`、`/api/package-orders/start`、`/api/package-orders/join`、`/api/user/package-groups` 和课包 `mock-success` 分支 smoke
- 本次验证已通过 `backend/tests/package-group-rules.test.js`、`backend/tests/package-group-admin.test.js`、`backend/tests/miniprogram-routes.mysql.test.js`、`backend/tests/console-api.mysql-routes.test.js`、`backend/tests/console-api.mysql-services.test.js`

#### H3 真环境 smoke

状态：未开始。

- 小程序：
  - 课包首页
  - 详情
  - 开团
  - 参团
  - 我的拼团
- 后台：
  - 登录
  - 课包管理
  - 课包订单
  - 课包拼团列表

## 4. 第二期任务清单

### P2-1 真支付接入

状态：未开始。

- 课包订单下单接微信支付
- 替换 mock-success 主路径

### P2-2 真退款接入

状态：未开始。

- 失败团自动退款走真实退款能力
- 后台手动退款走真实退款能力

### P2-3 通知接入

状态：未开始。

- 成团通知
- 失败退款通知
- 上课提醒通知

### P2-4 运营增强

状态：未开始。

- 更细的课包筛选条件
- 后台统计看板
- 分享链路优化

## 5. 建议排期

### 第一期

- 第 1 周：
  - A / B / C
- 第 2 周：
  - D / E / F
- 第 3 周：
  - G / H

### 第二期

- 第 4 周及以后：
  - P2-1 ~ P2-4

## 6. 当前建议的实施顺序

1. 先落数据库与 repository
2. 再落 shared service 和路由
3. 再改小程序页面和后台页面
4. 最后做真环境 smoke

## 7. 当前交接建议（截至 2026-04-19）

建议下一位 AI 按下面顺序继续：

1. 继续补 H1 / H2，优先覆盖 `packageSchedule`、`packageGroupRules`、`packageOrders` 和小程序课包主链路
2. 开始 F1 ~ F6 小程序前端，打通课包首页、详情、开团、参团、拼团详情、我的拼团
3. 推进 G1 ~ G4 后台前端，接入本次新增后台 API
4. 配置真实定时触发 `/api/internal/package-groups/cleanup-expired`，并做 H3 真环境 smoke

接手时建议先关注以下代码范围：

- `backend/migrations/mysql_init_schema.sql`
- `backend/migrations/mysql_step2b_package_group_core.sql`
- `backend/migrations/mysql_step5_seed_package_group.sql`
- `backend/repositories/coursePackagesRepository.js`
- `backend/repositories/packageGroupsRepository.js`
- `backend/repositories/ordersRepository.js`
- `backend/repositories/paymentRecordsRepository.js`
- `backend/shared/domain/packageGroupRules.js`
- `backend/shared/services/packageSchedule.js`
- `backend/shared/services/packageReaders.js`
- `backend/shared/services/packageOrders.js`
- `backend/shared/services/packageGroupStore.js`
- `backend/console-api/services/packageAdminService.js`
- `backend/console-api/routes/packages.js`
- `backend/console-api/routes/package-groups.js`
- `backend/console-api/routes/package-orders.js`
- `backend/routes/packages.js`
- `backend/routes/package-groups.js`
- `backend/routes/package-orders.js`
- `backend/routes/payments.js`
