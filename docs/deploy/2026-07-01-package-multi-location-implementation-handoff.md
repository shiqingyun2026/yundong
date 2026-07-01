# 2026-07-01 课包多地点实现交接

## 当前分支与工作区

- 分支：`codex/package-multi-location`
- worktree：`/Users/yun/lindong/.worktrees/package-multi-location`
- 主工作区：`/Users/yun/lindong`
- 当前实现策略：方案 B，新增 `course_package_locations` 归一化表，并在 `package_groups` 上锁定 `location_id` 与 `location_snapshot`。

## 需求口径

- 一个课程/课包支持多个地点。
- 多个地点之间价格、课时、排课规则一致。
- 教练不提前确定，成团后再安排。
- 首页课包只展示一条，距离取用户当前位置到该课包最近地点的距离，不展示具体小区。
- 课程详情页展示该课包支持的全部小区/地点。
- 开团页必须选择本次开团地点。
- 加入已有团时继承该团地点，用户不能再改地点。
- 课程详情页团列表展示所有地点的团，并显示团地点。
- 团列表排序：先按用户到团地点距离升序，再按截止时间升序；没有定位时按截止时间排序。

## 已完成提交

1. `f07386c docs: design package multi-location support`
   - 设计文档：`docs/superpowers/specs/2026-07-01-package-multi-location-design.md`

2. `13eb1c5 docs: plan package multi-location implementation`
   - 实施计划：`docs/superpowers/plans/2026-07-01-package-multi-location-implementation-plan.md`

3. `844e4d4 chore: ignore local worktrees`
   - 将 `.worktrees/` 加入 `.gitignore`。

4. `c9cfd4d feat: add package location schema`
   - 新增 migration：`docs/sql/package_multi_location_migration.sql`
   - 更新测试 schema 与 seed SQL。
   - 新增 `course_package_locations`。
   - `package_groups` 新增 `location_id`、`location_snapshot`。
   - seed 中为测试课包补了两个地点，并让测试团绑定地点。

5. `1b421c0 feat: add package location repositories`
   - 新增双侧地点 repository：
     - `backend/lindong-api/repositories/coursePackageLocationsRepository.js`
     - `backend/console-api-service/repositories/coursePackageLocationsRepository.js`
   - 更新双侧 `packageGroupsRepository` 读写团地点字段。
   - 更新双侧 `shared/services/packageReaders.js`，提供地点展示、团地点快照解析、按地点距离和截止时间排序等工具。
   - 新增测试：`backend/console-api-service/tests/package-location-rules.test.cjs`

6. `704c330 feat: expose package locations in mini program api`
   - 小程序后端课包列表按最近地点计算距离。
   - 小程序后端课包详情返回 `locations`。
   - 小程序后端详情团列表返回 `location_id`、`location_snapshot`、`location_text`、`distance_meters`。
   - 详情团列表支持按地点距离与截止时间排序。
   - 详情接口支持接收 `lat/lng` 或 `latitude/longitude`。

7. `4e0f23d feat: lock package group location`
   - 开团订单支持传入 `locationId` / `location_id`。
   - 开团时校验地点属于当前课包且启用。
   - 支付成功创建团时写入 `package_groups.location_id` 与 `location_snapshot`。
   - 加入已有团时继承团地点快照到订单上下文。
   - 双侧 `packageOrders` 与 `packageGroupRules` 已同步。

8. `8a720d1 feat: manage package locations in console api`
   - Console API 创建/编辑课包支持 `locations`。
   - 创建/编辑时保留 legacy 单地点字段为主地点，兼容旧查询与旧展示。
   - Console API 课包详情返回 `locations`。
   - Console API 团列表、团详情、订单列表返回地点字段与 `location_text`。

9. `feat: edit package locations in console`
   - Console 前端类型新增 `PackageLocation`、`PackageDetail.locations` 与团/订单地点字段。
   - 课包表单支持多个服务地点，支持新增、删除、启停、地点联想与经纬度解析。
   - 创建/编辑课包提交 `locations` 数组，并继续用第一个启用地点回填 legacy 单地点字段。
   - 编辑旧数据时，如果后端只返回 legacy 单地点字段，前端会初始化为一个地点。
   - 课包内嵌拼团记录、拼团列表、拼团详情、课包订单列表展示团地点。

10. `feat: select and display package locations`
   - 小程序课包详情 transform 返回 `locations`，活跃团返回团地点字段。
   - 课包详情页按当前定位请求详情，用于后端按团地点距离排序。
   - 首页课包卡片不再展示具体小区名，距离仍使用后端最近地点距离。
   - 课包详情页展示支持小区/场地，活跃团卡片展示团地点。
   - 开团页增加地点选择，只有一个地点时自动选中，提交开团订单时传 `locationId`。
   - 支付确认页和拼团详情页展示锁定后的上课地点。

## 已运行验证

在 `/Users/yun/lindong/.worktrees/package-multi-location`：

```bash
node --test backend/console-api-service/tests/package-schedule-rules.test.cjs
node --test backend/console-api-service/tests/package-location-rules.test.cjs
node -e "require('./backend/lindong-api/shared/services/packageOrders'); require('./backend/console-api-service/shared/services/packageOrders'); console.log('package orders loaded')"
node -e "require('./backend/console-api-service/console-api/services/packageAdminService.js'); console.log('package admin service loaded')"
cd console && npm run lint
node --test miniprogram/tests/package-location-transform.test.cjs
node --test miniprogram/tests/*.test.cjs
```

说明：
- worktree 内为了跑后端 require/test，已经分别在 `backend/lindong-api` 和 `backend/console-api-service` 执行过 `npm install`。
- 为了跑 Console 前端 typecheck，已经在 `console/` 执行过 `npm install`。
- `npm audit` 报过既有依赖漏洞，本次未处理。

## 当前状态

- 实现进度：实施计划 Task 1-8 已完成。
- Task 6：Console 前端已完成实现与验证。
- Task 7：小程序前端已完成实现与验证。
- Task 8：最终验证已按计划执行；Console build 产生过 `console/dist` 生成物，本次未纳入提交。
- `tiyubao-pre` 测试库 migration 已由本地 Node + `mysql2` 执行完成。
- 本地 Console 前后端已启动用于联调。
- worktree 当前应为干净状态；如只更新本文档，会出现本文档未提交变更。

## 2026-07-01 本地联调记录

### 测试库 migration

目标库：`tiyubao-pre`。

执行前回查：

```json
{
  "database": "tiyubao-pre",
  "hasCoursePackageLocations": false,
  "hasPackageGroupsLocationId": false,
  "hasPackageGroupsLocationSnapshot": false,
  "coursePackages": 13
}
```

执行后回查：

```json
{
  "database": "tiyubao-pre",
  "insertedRows": 13,
  "hasCoursePackageLocations": true,
  "hasPackageGroupsLocationId": true,
  "hasPackageGroupsLocationSnapshot": true,
  "coursePackageLocations": 13,
  "packagesWithoutLocation": 0
}
```

独立二次回查：

```json
{
  "database": "tiyubao-pre",
  "packageGroupColumns": ["location_id", "location_snapshot"],
  "coursePackageLocations": 13,
  "packagesWithoutLocation": 0
}
```

### 本地服务

Console API：

```bash
cd /Users/yun/lindong/.worktrees/package-multi-location/backend/console-api-service
env CONSOLE_API_PORT=8100 CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC=true \
  node -r dotenv/config console-api/server.js dotenv_config_path=/Users/yun/lindong/backend/.env
```

说明：
- `/Users/yun/lindong/backend/.env` 当前连接 `MYSQL_DATABASE=tiyubao-pre`。
- `CONSOLE_API_ENABLE_COURSE_LIFECYCLE_SYNC=true` 必须显式设置，否则本地 console-api 不会启动课程/课包生命周期同步定时任务。
- 健康检查已通过：`curl -s http://127.0.0.1:8100/health` 返回 `{"ok":true,"service":"lindong-console-api"}`。

Console 前端：

```bash
cd /Users/yun/lindong/.worktrees/package-multi-location/console
env VITE_API_BASE_URL=http://localhost:8100/api/admin npm run dev
```

访问地址：

```txt
http://localhost:3100/dashboard
```

### 已配置课包状态

课包：

```txt
PKG-20260701-0000
儿童体适能（启蒙班）多地址测试
```

曾出现问题：到达上架时间后仍为待上线。根因是本地 console-api 启动时未开启生命周期同步。

已手动执行一次：

```js
syncAllPackageLifecycles()
```

回查结果：

```json
{
  "database": "tiyubao-pre",
  "package": [
    {
      "id": "PKG-20260701-0000",
      "name": "儿童体适能（启蒙班）多地址测试",
      "status": 1,
      "publish_time": "2026-07-01T11:05:00.000Z"
    }
  ]
}
```

该课包在 `course_package_locations` 中已有 3 个启用地点：

```txt
PKG-20260701-0000-loc-001 聚龙花园
PKG-20260701-0000-loc-002 大世纪水山缘
PKG-20260701-0000-loc-003 佳兆业·可园
```

可用 SQL 回查：

```sql
USE `tiyubao-pre`;

SELECT *
FROM course_package_locations
WHERE package_id = 'PKG-20260701-0000'
ORDER BY sort_order;
```

### 微信开发者工具

本机存在微信开发者工具：

```txt
/Applications/wechatwebdevtools.app
```

项目应打开 worktree 根目录，而不是主工作区：

```txt
/Users/yun/lindong/.worktrees/package-multi-location
```

尝试使用 CLI：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project /Users/yun/lindong/.worktrees/package-multi-location \
  --port 9420
```

阻塞点：

```txt
IDE service port disabled.
```

需要在微信开发者工具中手动开启：

```txt
设置 -> 安全设置 -> 服务端口：开启
```

或者在 CLI 提示时输入 `y` 确认开启。此前未擅自开启，已中断该 CLI 调用。

小程序当前 `develop` 环境配置：

```txt
ENV_API_TRANSPORTS.develop = 'container'
ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop = 'lindong-api-test'
```

因此微信开发者工具里的小程序默认请求云托管测试服务 `lindong-api-test`，不是本地 `8100` 的 console-api。若要在开发者工具里看到 `PKG-20260701-0000`，需要确保：

1. 打开的代码目录是 `/Users/yun/lindong/.worktrees/package-multi-location`。
2. 云托管测试服务 `lindong-api-test` 已部署本分支小程序 API 代码，且连接 `tiyubao-pre`。
3. 或临时把小程序后端 transport/baseURL 切到本地小程序 API 服务，但这会涉及 `miniprogram/config/env.js` 改动，应单独确认后再做。

## 剩余任务

1. 微信开发者工具手动回归
   - 开启微信开发者工具服务端口，或手动打开 worktree 根目录。
   - 确认开发版小程序是否能从 `lindong-api-test` 看到 `PKG-20260701-0000`。
   - 如果看不到，优先确认 `lindong-api-test` 是否已部署本分支后端代码并连接 `tiyubao-pre`。
2. 视时间补充 Playwright 回归种子或手动回归记录。

## 继续入口建议

从这里继续：

```bash
cd /Users/yun/lindong/.worktrees/package-multi-location
git status --short
curl -s http://127.0.0.1:8100/health
```

然后继续微信开发者工具回归。

## 需要留意的问题

- 主工作区 `/Users/yun/lindong` 有用户已有改动，不要覆盖：
  - `console/dist/assets/index-C8oH1i_T.js` 删除
  - `console/dist/index.html` 修改
  - `miniprogram/config/env.js` 修改
  - `miniprogram/tests/env-config.test.cjs` 修改
  - `console/dist/assets/index-DkgWmQ0s.js` 新增
  - `docs/deploy/2026-06-30-console-frontend-deploy-handoff.md` 新增
- 不要直接改 `console/dist/` 作为功能实现目标。
- Console API 当前编辑课包时，如果调用方不传 `locations`，服务端会根据 payload 或旧 package 字段归一成地点列表。Console 前端更新后应始终提交 `locations`，但如需兼容第三方调用方，可以再增强为“不传 locations 时保留原地点列表”。
- `coursePackageLocationsRepository.replaceLocationsForPackage` 对没有传 `id` 的新地点会生成序号 ID。后续如果支持在已有课包中多次追加新地点，建议再补唯一 ID 冲突测试。
- migration 默认面向手工 DMS 执行，文件内已使用 `USE \`tiyubao-pre\`;`。执行生产前必须让用户确认库名与环境。
