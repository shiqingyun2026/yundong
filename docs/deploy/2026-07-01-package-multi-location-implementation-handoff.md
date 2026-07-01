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

## 已运行验证

在 `/Users/yun/lindong/.worktrees/package-multi-location`：

```bash
node --test backend/console-api-service/tests/package-schedule-rules.test.cjs
node --test backend/console-api-service/tests/package-location-rules.test.cjs
node -e "require('./backend/lindong-api/shared/services/packageOrders'); require('./backend/console-api-service/shared/services/packageOrders'); console.log('package orders loaded')"
node -e "require('./backend/console-api-service/console-api/services/packageAdminService.js'); console.log('package admin service loaded')"
cd console && npm run lint
```

说明：
- worktree 内为了跑后端 require/test，已经分别在 `backend/lindong-api` 和 `backend/console-api-service` 执行过 `npm install`。
- 为了跑 Console 前端 typecheck，已经在 `console/` 执行过 `npm install`。
- `npm audit` 报过既有依赖漏洞，本次未处理。

## 当前状态

- 实现进度停在实施计划的 Task 7：小程序前端。
- Task 6：Console 前端已完成实现与验证。
- worktree 当前提交后应为干净状态。

## 剩余任务

1. 小程序前端
   - 更新课包列表 transform，使用后端最近地点距离。
   - 首页不展示小区名。
   - 详情页展示支持的小区列表。
   - 开团页增加地点选择，提交开团订单时传 `locationId`。
   - 详情团列表卡片展示团地点。
   - 加团流程继承已有团地点，不提供地点选择。

2. 回归与验证
   - 至少跑已新增/受影响的 Node 测试。
   - 若改 Console 前端，跑对应 typecheck/build。
   - 若改小程序，补或更新最小 transform 单测。
   - 视时间补充 Playwright 回归种子或手动回归记录。

## 继续入口建议

从这里继续：

```bash
cd /Users/yun/lindong/.worktrees/package-multi-location
git status --short
sed -n '1,220p' miniprogram/utils/package.js
sed -n '1,220p' miniprogram/pages/course/detail/index.js
```

然后按实施计划 Task 7 做小程序前端。

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
