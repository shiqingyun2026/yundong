# 邻动体适能运营后台接口差异与数据核对清单

| 文档版本 | 修改日期       | 修改人 | 修改内容 |
| ---- | ---------- | --- | ---- |
| V1.0 | 2026-03-25 | Codex | 基于现有 console 文档与当前代码实现整理差异核对清单 |

## 1. 文档目的

本文档用于在正式搭建运营后台前，对照以下两类信息来源进行排查：

1. 运营后台设计文档：
   [`console_prd.md`](/Users/yun/lindong/docs/console/console_prd.md)
   [`console_api.md`](/Users/yun/lindong/docs/console/console_api.md)
   [`console_tech.md`](/Users/yun/lindong/docs/console/console_tech.md)
2. 当前真实代码实现：
   [`backend/server.js`](/Users/yun/lindong/backend/server.js)
   [`backend/routes/courses.js`](/Users/yun/lindong/backend/routes/courses.js)
   [`backend/routes/orders.js`](/Users/yun/lindong/backend/routes/orders.js)
   [`backend/routes/payments.js`](/Users/yun/lindong/backend/routes/payments.js)
   [`backend/routes/groups.js`](/Users/yun/lindong/backend/routes/groups.js)
   [`backend/routes/auth.js`](/Users/yun/lindong/backend/routes/auth.js)
   [`backend/routes/user.js`](/Users/yun/lindong/backend/routes/user.js)
   [`docs/miniprogram/handoff.md`](/Users/yun/lindong/docs/miniprogram/handoff.md)

目标不是简单记录“文档和代码不同”，而是明确哪些差异会直接影响运营后台搭建，哪些内容必须在开发前先对齐。

## 2. 当前结论摘要

当前代码库中的后端仍然是“小程序用户态服务”，并不是“运营后台管理端服务”。这意味着 `docs/console` 中定义的大部分后台接口、账号模型、权限体系和页面职责，目前在真实代码中都还没有落地。

可以明确的现状如下：

1. 当前后端没有 `/api/admin/*` 命名空间，只有小程序用户相关接口。
2. 当前登录接口是微信用户登录，不是管理员登录。
3. 当前订单接口只覆盖“创建订单”和“模拟支付成功”，不包含后台订单列表、订单详情、退款。
4. 当前课程接口偏向家长端展示聚合，不是后台 CRUD 接口。
5. 当前代码中未发现 `admin_users`、`admin_log` 相关实现。
6. 当前真实表名和字段命名，与 `console` 文档中给出的示意命名存在一定差异，需要先做库表核验。

## 3. 差异清单

### 3.1 服务边界差异

#### 3.1.1 路由入口差异

文档预期：

1. 后台接口应以 `/api/admin` 为基础路径。
2. 包含登录、账号管理、课程管理、订单管理、上传签名等完整后台能力。

当前实现：

1. [`backend/server.js`](/Users/yun/lindong/backend/server.js) 只注册了：
   `/api/auth`
   `/api/courses`
   `/api/groups`
   `/api/orders`
   `/api/payments`
   `/api/user`
2. 不存在 `/api/admin/*` 路由。

结论：

运营后台不能直接复用当前接口结构，需要单独新增管理端命名空间，避免把家长端接口继续堆成混合服务。

核对动作：

1. 确认管理端是否新建独立服务，或作为现有 Express 服务下的 `/api/admin/*` 子路由。
2. 确认前后端联调基线接口目录结构。

#### 3.1.2 权限主体差异

文档预期：

1. 后台管理员通过 `admin_users` 管理。
2. 基于管理员角色控制权限，区分 `super_admin` 与 `admin`。
3. 后台 BFF 使用管理员身份做鉴权和审计。

当前实现：

1. [`backend/routes/auth.js`](/Users/yun/lindong/backend/routes/auth.js) 是小程序用户登录。
2. [`backend/middleware/auth.js`](/Users/yun/lindong/backend/middleware/auth.js) 只校验 JWT 中的 `userId`，并未校验管理员身份。
3. 当前未发现 `admin_users` 表访问代码。

结论：

后台登录与权限体系需要从零补建，不能直接沿用当前小程序用户鉴权。

核对动作：

1. 确认管理员账号是使用 Supabase Auth 还是自建账号体系。
2. 确认是否真的采用 `admin_users` 表承载角色信息。

### 3.2 接口能力差异

#### 3.2.1 登录接口差异

文档预期：

1. 管理员通过用户名密码登录。
2. 返回管理员 token 和角色信息。

当前实现：

1. 登录接口为 `POST /api/auth/login`。
2. 入参为 `code` 和可选 `mockOpenId`。
3. 返回的是小程序用户 token 和 `userInfo`，不含后台角色。

结论：

后台登录接口必须新建，不能复用现有用户登录逻辑。

#### 3.2.2 账号管理接口差异

文档预期：

1. 支持账号列表、新增、编辑、删除。
2. 仅超级管理员可操作。

当前实现：

1. 未发现账号管理路由。
2. 未发现管理员表和角色校验逻辑。

结论：

账号管理模块为纯新增能力。

#### 3.2.3 课程管理接口差异

文档预期：

1. 后台课程列表支持按名称、时间范围搜索、分页。
2. 支持课程详情、新增、编辑、下架。
3. 返回字段以后台表单字段为中心。

当前实现：

1. [`backend/routes/courses.js`](/Users/yun/lindong/backend/routes/courses.js) 已有：
   `GET /api/courses`
   `GET /api/courses/:id`
   `GET /api/courses/:id/active-group`
2. 当前课程接口用于家长端展示聚合，返回内容包含：
   `activeGroup`
   `completedGroupsCount`
   `successJoinedCount`
   `groupList`
   `descriptionHtml`
3. 未发现课程新增、编辑、下架接口。
4. 当前课程列表查询参数是 `page/pageSize/sort`，不支持后台文档中定义的 `keyword/start_date/end_date`。

结论：

家长端课程查询可复用部分聚合逻辑，但后台课程 CRUD 仍需单独实现。

核对动作：

1. 确认后台课程列表是否直接查课程表，还是要附带当前团与累计成团统计。
2. 确认后台“课程状态”是依赖时间自动计算，还是使用数据库持久字段。

#### 3.2.4 订单管理接口差异

文档预期：

1. 支持后台订单列表、订单详情、手动退款。
2. 支持按订单号、昵称、手机号、课程名称筛选。

当前实现：

1. [`backend/routes/orders.js`](/Users/yun/lindong/backend/routes/orders.js) 只实现 `POST /api/orders`。
2. 当前接口职责是“创建订单并决定是否开新团/加入已有团”。
3. 未发现订单列表、订单详情、退款接口。
4. [`backend/routes/payments.js`](/Users/yun/lindong/backend/routes/payments.js) 只有 `POST /api/payments/mock-success`，用于模拟支付成功。

结论：

后台订单管理模块也基本属于新增实现。

核对动作：

1. 明确订单列表是否直接基于 `orders` 表查询。
2. 明确 `orders.status` 当前真实取值集合，以及与文档中的“已支付/已退款”映射关系。

#### 3.2.5 拼团详情与辅助接口差异

文档与交接现状：

1. 小程序拼团详情页继续保持单团详情定位。
2. `GET /api/courses/:id/active-group` 当前名称与语义不一致。

当前实现：

1. [`backend/routes/courses.js`](/Users/yun/lindong/backend/routes/courses.js) 中的 `GET /:id/active-group` 在没有进行中团时，会回退返回最近一个成功或失败团。
2. [`backend/routes/groups.js`](/Users/yun/lindong/backend/routes/groups.js) 对非成员访问返回 `403`，符合交接文档描述。

结论：

后台不要直接把 `active-group` 当成运营查询接口使用，避免误导运营对课程状态的判断。

核对动作：

1. 后台如需展示当前进行中团，应新增明确语义字段或接口。
2. 课程维度统计和单团维度详情要分离查询。

### 3.3 数据模型差异

#### 3.3.1 表名差异

文档描述中多使用：

1. `course`
2. `group`
3. `order`
4. `admin_users`
5. `admin_log`

当前代码实际访问表名：

1. `courses`
2. `groups`
3. `orders`
4. `users`
5. `group_members`

当前未发现实际访问：

1. `admin_users`
2. `admin_log`

结论：

文档与真实表名明显不完全一致，正式开发前必须以数据库实际结构为准，不能只按文档猜。

核对动作：

1. 导出 Supabase 实际 schema。
2. 形成正式字段映射表，注明“文档名 / 实际表名 / 前端字段名”。

#### 3.3.2 课程字段差异

文档中的课程字段偏标准化，包括：

1. `title`
2. `location_district`
3. `location_community`
4. `location_detail`
5. `age_range`
6. `coach_cert`
7. `deadline`

当前代码中已明确使用过的课程字段包括：

1. `name`
2. `cover`
3. `images`
4. `address`
5. `start_time`
6. `group_price`
7. `original_price`
8. `max_groups`
9. `age_limit`
10. `description`
11. `coach_name`
12. `coach_intro`
13. `coach_certificates`
14. `insurance_desc`
15. `service_qr_code`

结论：

课程模型当前至少存在“文档字段名”和“现有库字段名”两套表达，需要在后台表单层统一映射。

核对动作：

1. 确认数据库中是否已经存在区域、小区、详细地点、经纬度、截止时间等字段。
2. 如果不存在，明确是补字段还是在后台先裁剪需求。

#### 3.3.3 订单字段差异

文档中的订单详情包含：

1. `order_no`
2. `refund_time`
3. `refund_reason`
4. 用户手机号
5. 课程信息与拼团信息聚合

当前代码中可确认的订单字段使用包括：

1. `id`
2. `user_id`
3. `course_id`
4. `group_id`
5. `amount`
6. `status`

当前未在代码里看到的事项：

1. `order_no` 生成逻辑
2. 退款字段的读写逻辑
3. 用户手机号在订单列表中的关联查询逻辑

结论：

订单后台展示能力依赖更多字段和联表查询，可能需要先补库表字段或确认现有表结构。

核对动作：

1. 确认 `orders` 表完整字段。
2. 确认手机号是在 `users.phone` 还是其他表字段。

#### 3.3.4 管理员与审计表差异

文档中明确要求：

1. `admin_users`
2. `admin_log`

当前实现：

1. 未发现这两张表的任何访问代码。

结论：

管理员管理和审计能力不能假设已存在，需要先确认数据库中是否已经建表。

核对动作：

1. 确认两张表是否已在 Supabase 建立。
2. 若未建立，先输出建表与索引方案。

### 3.4 业务规则差异与待确认项

#### 3.4.1 目标成团人数来源不一致

文档预期：

课程表单中有“成团人数”字段，通常映射为课程配置的一部分。

当前实现：

1. [`backend/routes/orders.js`](/Users/yun/lindong/backend/routes/orders.js) 在开新团时使用 `defaultTargetCount = 2`。
2. 创建新团时并没有从课程字段读取 `target_count`。

结论：

这是一个必须优先核对的业务偏差。后台如果按 PRD 配置了课程成团人数，而下单时仍然固定开 2 人团，业务一定会错。

核对动作：

1. 确认课程表是否已有成团人数字段。
2. 若有，订单创建逻辑需改为读取课程配置。

#### 3.4.2 支付成功与入团时机

交接文档口径：

1. 创建订单但未支付时，不增加拼团人数。
2. 只有支付成功后，才真正入团并更新人数。

当前实现：

1. [`backend/routes/orders.js`](/Users/yun/lindong/backend/routes/orders.js) 创建订单时不写入 `group_members`，符合口径。
2. [`backend/routes/payments.js`](/Users/yun/lindong/backend/routes/payments.js) 在 `mock-success` 时才插入 `group_members` 并更新 `groups.current_count`，符合口径。

结论：

这一点文档与当前实现基本一致，可以作为后台订单与拼团展示的真实依据。

#### 3.4.3 退款回滚规则仍不完整

文档中提到了后台退款，但当前代码没有实现正式退款。

待确认问题：

1. 退款后是否删除 `group_members`。
2. 退款后是否回滚 `groups.current_count`。
3. 已成团订单退款后，团状态是否需要重新计算。
4. 失败团自动退款与人工退款的展示口径是否一致。

结论：

退款规则在后台开发前必须先补齐，否则订单与拼团数据容易失真。

## 4. 开发前必须完成的核对项

以下事项建议作为正式开工前的阻塞项处理：

1. 确认管理端接口命名空间与服务边界。
2. 导出 Supabase 实际表结构，核对 `courses/groups/orders/users/group_members`。
3. 确认 `admin_users`、`admin_log` 是否已存在，不存在则先补设计。
4. 确认课程表中是否已有后台 PRD 所需字段，尤其是成团人数、报名截止时间、区域、小区、详细地点、经纬度、教练证书。
5. 确认订单表完整字段，尤其是 `order_no`、退款字段、支付时间。
6. 确认退款后的团成员与人数回滚规则。
7. 确认后台课程状态的计算方式和下架字段语义。
8. 确认是否沿用当前 Express 服务继续扩展，还是新建独立后台 BFF。

## 5. 建议处理顺序

### 5.1 第一优先级

1. 真实库表核验。
2. 管理端鉴权模型确认。
3. 课程成团人数与订单创建逻辑对齐。
4. 退款口径确认。

### 5.2 第二优先级

1. 后台课程 CRUD 接口设计。
2. 后台订单列表与详情接口设计。
3. 账号管理接口与角色权限设计。

### 5.3 第三优先级

1. 操作日志表与审计方案。
2. 上传签名与富文本图片上传方案。
3. 部署、监控与 CI/CD 方案。

## 6. 结论

当前 `docs/console` 已经给出了较完整的运营后台目标形态，但现有代码库中的真实后端实现仍然主要服务小程序用户侧。对于运营后台来说，当前阶段最重要的不是立即开页面，而是先完成“接口边界、数据模型、权限体系、退款规则”4 个方面的核对。只有这些基础口径确认完，后续后台开发才能避免出现字段对不上、接口语义错误、订单与拼团数据不一致的问题。
