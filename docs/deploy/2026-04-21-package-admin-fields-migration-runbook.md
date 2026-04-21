# 2026-04-21 课包后台字段扩展 Migration 执行方案

## 1. 变更目标

本次 migration 用于支持课包后台新字段与新状态规则，涉及表：

- `course_packages`

新增字段：

- `class_count`
- `class_duration_minutes`
- `group_price_config`
- `publish_time`
- `unpublish_time`

对应 SQL 文件：

- [20260421_package_admin_fields.sql](/Users/yun/lindong/backend/migrations/20260421_package_admin_fields.sql)

---

## 2. 前置判断

执行前先确认目标环境已经具备课包主表 `course_packages`。

若目标库还没有课包相关结构，需要先补齐旧链路：

1. `mysql_step2b_package_group_core.sql`
2. `mysql_step2c_package_category.sql`

若目标库已经正常跑过课包功能，只需要执行：

1. `20260421_package_admin_fields.sql`

---

## 3. 本地环境执行方案

### 3.1 环境变量

后端读取以下 MySQL 配置：

- `USE_MYSQL_REPOSITORIES=true`
- `MYSQL_HOST` 或 `DB_HOST`
- `MYSQL_PORT` 或 `DB_PORT`
- `MYSQL_USER` 或 `DB_USER`
- `MYSQL_PASSWORD` 或 `DB_PASSWORD`
- `MYSQL_DATABASE` 或 `DB_DATABASE`

可先在本地 shell 中确认：

```bash
echo $USE_MYSQL_REPOSITORIES
echo $MYSQL_HOST
echo $MYSQL_DATABASE
```

### 3.2 执行前检查

先查看目标表是否已存在，以及新增字段是否尚未落库：

```bash
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE 'course_packages';"
```

```bash
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM course_packages;"
```

若已经能看到以下字段，则说明 migration 已执行过，不要重复执行：

- `class_count`
- `class_duration_minutes`
- `group_price_config`
- `publish_time`
- `unpublish_time`

### 3.3 执行 migration

```bash
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < /Users/yun/lindong/backend/migrations/20260421_package_admin_fields.sql
```

### 3.4 执行后校验

再次查看字段：

```bash
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM course_packages;"
```

建议额外检查字段类型：

- `class_count` 应为 `INT`
- `class_duration_minutes` 应为 `INT`
- `group_price_config` 应为 `JSON`
- `publish_time` 应为 `DATETIME`
- `unpublish_time` 应为 `DATETIME`

### 3.5 本地联调验证

执行 migration 后，至少完成以下验证：

1. 启动后台服务：

```bash
cd /Users/yun/lindong/backend
npm run console:dev
```

2. 启动 console 前端：

```bash
cd /Users/yun/lindong/console
npm run dev
```

3. 在课包后台验证：

- 新建课包能提交 `class_count` / `class_duration_minutes` / `group_price_config`
- 保存后详情页能回显 `publish_time`
- 课包列表能按 `pending / active / inactive` 正确展示状态
- 下架操作后 `unpublish_time` 正常写入

4. 跑关键回归测试：

```bash
cd /Users/yun/lindong/console
node --test ../backend/tests/package-group-rules.test.js ../backend/tests/package-group-admin.test.js ../backend/tests/console-api.mysql-services.test.js
```

---

## 4. 目标环境执行方案

### 4.1 执行窗口建议

本次变更属于“加字段”型 migration，风险相对可控，但仍建议：

- 在低峰期执行
- 先发 SQL，再发后端
- 后端发布完成后再验证前端

推荐顺序：

1. 备份目标库
2. 执行 migration
3. 发布 backend / console-api
4. 发布 console 前端
5. 做冒烟验证

### 4.2 备份建议

执行前至少导出 `course_packages`：

```bash
mysqldump -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" course_packages > course_packages_$(date +%Y%m%d_%H%M%S).sql
```

若本次准备一起联调课包拼团金额，建议同时备份：

- `package_groups`
- `orders`
- `payment_records`

### 4.3 执行 migration

```bash
mysql -h "$MYSQL_HOST" -P "${MYSQL_PORT:-3306}" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < /path/to/backend/migrations/20260421_package_admin_fields.sql
```

### 4.4 目标环境发布后验证

建议按下面顺序验证：

1. 管理端登录正常
2. 课包列表页正常打开
3. 旧课包详情页正常打开，不报字段错误
4. 新建课包成功
5. 编辑课包成功
6. 下架课包成功
7. 小程序课包列表仍可正常展示
8. 小程序课包详情金额与后台 `group_price_config` 一致

---

## 5. 数据兼容说明

### 5.1 旧数据的默认值

旧数据执行 migration 后：

- `class_count = 0`
- `class_duration_minutes = 0`
- `group_price_config = NULL`
- `publish_time = NULL`
- `unpublish_time = NULL`

这意味着：

- 旧课包不会自动拥有完整的新业务字段
- 需要运营在后台重新补齐关键字段后，才能完全符合新口径

### 5.2 兼容策略

当前代码已做以下兼容：

- `supported_people` 仍保留
- 金额读取优先走 `group_price_config`，缺失时可回退旧逻辑
- `cover` 可兼容同步到 `images`

但对“正式运营可用”的要求仍是：

- 补齐 `publish_time`
- 补齐 `class_count`
- 补齐 `class_duration_minutes`
- 补齐 `group_price_config`

---

## 6. 回滚方案

本次是新增字段，不涉及删字段或改名，数据库层原则上不建议立即物理回滚。

若发布后发现应用层异常，优先回滚应用代码：

1. 回滚 backend / console-api 到上一版本
2. 保留新增字段不删
3. 排查并修复后重新发布

只有在明确确认需要数据库回滚时，才手工执行：

```sql
ALTER TABLE `course_packages`
  DROP COLUMN `unpublish_time`,
  DROP COLUMN `publish_time`,
  DROP COLUMN `group_price_config`,
  DROP COLUMN `class_duration_minutes`,
  DROP COLUMN `class_count`;
```

注意：

- 该回滚 SQL 是破坏性操作
- 若新版本已经写入了新字段数据，执行前必须先确认是否需要保留

---

## 7. 推荐执行清单

### 本地

1. 确认 `.env` 指向本地测试库
2. `SHOW COLUMNS FROM course_packages`
3. 执行 `20260421_package_admin_fields.sql`
4. 启动 backend / console
5. 新建一条课包验证
6. 跑后端关键测试

### 目标环境

1. 备份 `course_packages`
2. 检查目标库是否已存在新增字段
3. 执行 `20260421_package_admin_fields.sql`
4. 发布 backend / console-api
5. 发布 console 前端
6. 做课包列表 / 新建 / 编辑 / 下架 / 小程序详情冒烟

