# 邻动体适能运营后台数据库变更方案

| 文档版本 | 修改日期       | 修改人 | 修改内容 |
| ---- | ---------- | --- | ---- |
| V1.0 | 2026-03-25 | Codex | 基于真实 schema 核验结果整理后台数据库变更方案 |

## 1. 目标

本方案用于补齐运营后台所需的数据承载能力，使当前仅能支撑小程序用户侧的库表结构，扩展为可支持后台登录、权限、课程配置、订单管理、退款审计的正式模型。

本方案遵循两个原则：

1. 优先增量扩展现有表，避免影响小程序当前主链路。
2. 管理端专属能力单独建表，不把后台权限逻辑混入小程序用户模型。

## 2. 变更结论

建议将数据库变更分为两类：

### 2.1 必须新增

1. `admin_users`
2. `admin_log`

### 2.2 建议补充字段

1. `courses`
2. `orders`
3. `users`

## 3. 详细变更项

### 3.1 新增 `admin_users`

用途：

1. 承载后台管理员身份。
2. 承载管理员角色信息。
3. 与 Supabase Auth 或其他管理员登录机制绑定。

建议字段：

| 字段名 | 类型 | 约束 | 说明 |
| ---- | ---- | ---- | ---- |
| `id` | uuid | PK | 管理员 ID，建议与认证体系用户 ID 对齐 |
| `email` | varchar(100) | UNIQUE NOT NULL | 登录邮箱 |
| `username` | varchar(50) | NOT NULL | 显示用户名 |
| `role` | varchar(20) | NOT NULL | `super_admin` / `admin` |
| `status` | varchar(20) | NOT NULL DEFAULT 'active' | 账号状态 |
| `last_login` | timestamptz | NULL | 最后登录时间 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | 创建时间 |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | 更新时间 |

说明：

1. 若后续接入更多角色，可扩展 `role` 枚举，但本期先控制在 `super_admin` 和 `admin`。
2. 若不使用 Supabase Auth，也可将 `id` 设计为普通 uuid，但推荐与认证体系对齐。

### 3.2 新增 `admin_log`

用途：

1. 记录后台敏感操作。
2. 支撑审计、追责、回溯。

建议字段：

| 字段名 | 类型 | 约束 | 说明 |
| ---- | ---- | ---- | ---- |
| `id` | bigserial | PK | 日志 ID |
| `admin_id` | uuid | NOT NULL | 操作管理员 |
| `action` | varchar(50) | NOT NULL | 操作类型 |
| `target_type` | varchar(50) | NULL | 目标对象类型 |
| `target_id` | varchar(100) | NULL | 目标对象 ID |
| `detail` | jsonb | NULL | 操作详情 |
| `ip` | inet | NULL | 请求 IP |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | 操作时间 |

建议记录的 `action` 包括：

1. `admin_login`
2. `account_create`
3. `account_update`
4. `account_delete`
5. `course_create`
6. `course_update`
7. `course_offline`
8. `order_refund`

### 3.3 扩展 `courses`

当前 `courses` 已具备部分课程信息，但不足以完整支撑后台 PRD。建议补充以下字段：

| 字段名 | 类型 | 说明 |
| ---- | ---- | ---- |
| `end_time` | timestamptz | 上课结束时间 |
| `deadline` | timestamptz | 报名截止时间 |
| `location_district` | varchar(100) | 所在区域 |
| `location_community` | varchar(100) | 小区名称 |
| `location_detail` | varchar(255) | 详细地点 |
| `longitude` | numeric(10,6) | 经度 |
| `latitude` | numeric(10,6) | 纬度 |
| `default_target_count` | integer | 课程默认成团人数 |
| `status` | smallint | 0待开始 / 1进行中 / 2已结束 / 3已下架 |
| `updated_at` | timestamptz | 更新时间 |
| `created_by` | uuid | 创建人管理员 ID |
| `updated_by` | uuid | 更新人管理员 ID |

说明：

1. 当前小程序使用 `address` 单字段，建议短期保留，作为兼容展示字段。
2. 新增结构化地址后，可由后台在保存时同步生成 `address`，避免影响小程序旧代码。
3. `default_target_count` 用于解决当前开团逻辑仍写死 `2` 人团的问题。

### 3.4 扩展 `orders`

当前 `orders` 字段不足以支撑后台订单管理，建议补充：

| 字段名 | 类型 | 说明 |
| ---- | ---- | ---- |
| `order_no` | varchar(32) | 业务订单号 |
| `pay_time` | timestamptz | 支付成功时间 |
| `refund_time` | timestamptz | 退款时间 |
| `refund_reason` | text | 退款原因 |
| `refund_operator_id` | uuid | 操作退款管理员 ID |
| `transaction_id` | varchar(64) | 支付流水号，可先留空 |
| `status` | varchar(20) | 建议扩展为 `pending/success/refunded/closed` |
| `updated_at` | timestamptz | 更新时间 |

说明：

1. `status` 当前已有 `pending/success`，建议保留兼容并新增 `refunded`。
2. 若后续接入真实微信支付，可继续追加第三方交易信息字段。

### 3.5 扩展 `users`

这里需要先区分“后台真实需要”与“现阶段技术现状”。

建议方案：

1. 若产品仍坚持后台查看手机号，则新增 `phone varchar(20)`。
2. 若当前阶段不恢复手机号能力，则应同步调整后台 PRD，不强行补表字段。

说明：

当前小程序技术文档已明确移除手机号授权，因此这里是产品决策项，不建议技术先行硬加。

## 4. 状态与业务规则建议

### 4.1 课程状态

建议采用以下规则：

1. `0` 待开始
2. `1` 进行中
3. `2` 已结束
4. `3` 已下架

建议逻辑：

1. `已下架` 由后台人工设置。
2. 其他时间态可由后端按时间计算，前端只读展示。

### 4.2 订单状态

建议采用以下状态：

1. `pending`
2. `success`
3. `refunded`
4. `closed`

说明：

1. `pending` 表示已创建未支付。
2. `success` 表示已支付成功。
3. `refunded` 表示已退款。
4. `closed` 可用于超时取消或失效订单。

### 4.3 团状态

建议继续兼容现有模型：

1. `active`
2. `success`
3. `failed`

说明：

1. 后台不要再用 `ongoing` 作为数据库值，它只适合前端展示映射。

## 5. 兼容性建议

### 5.1 对小程序的兼容

为避免影响当前小程序联调链路，建议：

1. 不删除现有字段。
2. 不修改现有字段含义。
3. 所有新增字段都采用向后兼容方式扩展。
4. 在小程序完全切换前，保留 `address`、`name`、`age_limit` 等当前字段。

### 5.2 对后台的兼容

后台接口设计时应：

1. 优先输出标准化字段。
2. 必要时在 BFF 中做旧字段到新字段的映射。
3. 不把前端页面直接绑定到数据库原始字段名上。

## 6. 迁移顺序建议

建议分三步迁移：

### 第一步：补管理端基础表

1. 新增 `admin_users`
2. 新增 `admin_log`

### 第二步：补后台关键业务字段

1. 扩展 `courses`
2. 扩展 `orders`
3. 视产品结论决定是否扩展 `users.phone`

### 第三步：补代码逻辑

1. 将新开团逻辑改为读取 `courses.default_target_count`
2. 在支付成功时补写 `orders.pay_time`
3. 在退款时补写退款字段并处理团状态回滚

## 7. 风险提示

1. 如果直接修改现有小程序接口去适配后台字段，容易引发联调回归。
2. 如果先做后台页面、不先补表字段，后续大概率二次返工。
3. 手机号字段是否恢复是产品决策，不建议在未确认前直接进入开发。
4. `default_target_count` 若不补齐，后台课程表单中的“成团人数”将无法真正影响下单开团逻辑。

## 8. 结论

运营后台的数据库改造应以“新增管理端模型、补齐后台所需业务字段、保持小程序链路兼容”为主线推进。最优先的动作是补 `admin_users` 和 `admin_log`，其次是补 `courses` 与 `orders` 的后台必需字段，再进入管理端接口和页面开发。
