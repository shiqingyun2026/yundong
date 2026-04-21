# 2026-04-21 后台新建课程字段扩展方案 A 交接文档

## 1. 背景

当前 console 后台“新建课包”表单，只有：

- `total_price_fen`
- `supported_people`

但家长端最新课程详情展示和后续支付口径，已经不再适合只靠“总价 + 支持人数”推导。

本轮已确认采用 **方案 A**：

- 正式新增课程字段：
  - `class_count`
  - `class_duration_minutes`
  - `group_price_config`
- `supported_people` 保留，但改为 **派生字段**
- `total_price_fen` 保留，但改为 **展示/运营参考价**
- 实际每人支付金额，后续统一以 `group_price_config` 为准，不再用 `total_price_fen / target_count`

这份文档用于交给下一个 AI 继续实现代码改造。

## 2. 已确认方案

### 2.1 目标

后台新建/编辑课程时，补齐以下业务信息：

- 节数
- 课时长
- 各团型单独售价

对应正式字段：

- `class_count`: 课程总节数
- `class_duration_minutes`: 单节课时长，单位分钟
- `group_price_config`: 不同团型的人均售价配置

### 2.2 方案 A 的核心原则

1. 不废弃当前 `course_packages` 主表，直接在现有模型上扩展字段。
2. 不删除 `supported_people`，但不再把它作为后台主输入项。
3. 后台运营录入的“团型”和“人均价”来源统一为 `group_price_config`。
4. `supported_people` 从 `group_price_config[*].target_count` 自动派生。
5. 前台详情页“X 节课 / XX 分钟 / 上课时间家长定”应最终走真实字段，不再靠前端兜底。
6. 订单金额、拼团金额、详情页各团型金额，后续统一从 `group_price_config` 查值。

## 3. 字段设计

### 3.1 `course_packages` 新增字段

建议新增：

- `class_count int not null default 0`
- `class_duration_minutes int not null default 0`
- `group_price_config json null`

建议的 `group_price_config` 结构：

```json
[
  { "target_count": 4, "price_fen": 50000 },
  { "target_count": 6, "price_fen": 40000 },
  { "target_count": 8, "price_fen": 30000 }
]
```

字段含义：

- `target_count`: 团型人数
- `price_fen`: 该团型下“每人支付金额”，单位分

### 3.2 旧字段保留策略

继续保留：

- `total_price`
- `supported_people`

新的职责定义：

- `total_price`
  - 仍对外映射为 `total_price_fen`
  - 作为“总价/原价/运营参考价”保留
  - 不再作为实际拼团支付金额的计算依据
- `supported_people`
  - 仍可在接口里返回
  - 但不再由运营手工输入
  - 改为从 `group_price_config` 自动生成，例如 `[4, 6, 8]`

### 3.3 课包状态规则补充

课包状态需要从当前的二态：

- `active`
- `inactive`

升级为三态：

- `pending`: 待上架
- `active`: 已上架
- `inactive`: 已下架

对应产品口径：

- 新建课程时，不手动选择状态
- 新建课程时，改为录入“上架时间”
- 若当前时间未到上架时间，状态为 `pending`
- 到达上架时间后，状态自动切换为 `active`
- 后台课包管理中，可对 `pending` 和 `active` 的课包执行“下架”
- 下架后状态变为 `inactive`
- `inactive` 课包不再在小程序首页课程列表中展示
- 但若该课包下已有已成团记录，相关拼团详情页家长仍可正常查看

建议新增字段：

- `publish_time datetime null`

如需保留显式下架时间用于审计，可一并新增：

- `unpublish_time datetime null`

推荐优先规则：

- `inactive` 为人工终态，优先级最高
- `pending` / `active` 由当前时间与 `publish_time` 对比决定

也就是说：

- 只要已执行下架，哪怕时间已到，也不再自动恢复为 `active`

## 4. 校验规则

### 4.1 表单与服务端统一校验

- `class_count > 0`
- `class_duration_minutes > 0`
- `group_price_config` 至少 1 条
- 每条 `target_count` 必须是正整数
- 每条 `price_fen` 必须是正整数
- `group_price_config` 内 `target_count` 不允许重复

### 4.2 建议的补充约束

- `group_price_config` 按 `target_count` 升序存储
- `supported_people` 同步生成为升序数组
- 当 `group_price_config` 存在时，禁止再单独相信前端传入的 `supported_people`
- `publish_time` 为必填
- 新建课包时不允许前端直接提交最终状态为 `active/inactive`
- 新建课包的初始状态应由服务端根据 `publish_time` 自动决定

### 4.3 状态判定规则

建议统一为以下逻辑：

1. 如果已人工下架，则状态固定为 `inactive`
2. 如果未下架，且 `now < publish_time`，状态为 `pending`
3. 如果未下架，且 `now >= publish_time`，状态为 `active`

建议不要依赖人工定时脚本去把数据库批量“改状态”，而是优先使用“读取时计算 + 写入时固化必要字段”的方案，避免状态漂移。

## 5. console 后台表单改造

## 5.1 目标页面

- `console/src/pages/PackageFormPage.tsx`
- `console/src/types.ts`

### 5.2 表单调整建议

当前表单里有：

- 总价
- 支持的几人团选项

方案 A 建议改为：

保留：

- 总价（参考价）

新增：

- 节数
- 课时长（分钟）
- 各团型售价配置
- 上架时间
- 腾讯地图地点搜索
- 课包介绍图片上传
- 教练简介图片上传

调整：

- “支持的几人团选项”不再作为主输入项
- 可以直接移除可编辑输入框，改为只读预览
- 或者暂时隐藏，仅在提交时由 `group_price_config` 自动生成
- “状态”不再出现在新建页可编辑表单中
- 课包不再单独维护“轮播图”
- 封面图同时作为课程详情顶部主图使用

### 5.3 状态相关交互

新建页：

- 不显示“状态”下拉框
- 显示“上架时间”选择器
- 保存后由后端返回当前计算后的状态文案：
  - 未到时间：`待上架`
  - 已到时间：`已上架`

列表页：

- 状态筛选改为：
  - `待上架`
  - `已上架`
  - `已下架`
- 操作列中：
  - `pending`、`active` 显示“下架”
  - `inactive` 不再显示“下架”

下架交互：

- 点击“下架”后弹窗二次确认
- 明确提示：

```text
确认下架该课程吗？
下架后，该课程将不会继续在小程序首页展示。
如该课程存在未完成的拼团，系统将按原价退回相关订单金额。
```

确认后：

- 课包状态改为 `inactive`
- 记录 `unpublish_time`

### 5.4 推荐交互

推荐做成一组可增删的团型价格行：

```json
[
  { "target_count": 4, "price_fen": 50000 },
  { "target_count": 6, "price_fen": 40000 },
  { "target_count": 8, "price_fen": 30000 }
]
```

每行包含：

- 团型人数输入框
- 单独售价输入框
- 删除按钮

底部提供：

- “新增团型”按钮

### 5.5 富文本与图片交互补充

课包介绍：

- 不再只支持纯文本 textarea
- 需要支持插入图片
- 推荐复用当前 `CourseFormPage.tsx` 已有的图片上传方式
- 上传成功后，直接把图片 URL 以 HTML `<img />` 或系统约定的富文本片段插入到介绍内容中

教练简介：

- 同样需要支持插入图片
- 不再只是纯文本介绍
- 推荐与“课包介绍”共用同一套“上传图片并插入内容”的编辑交互

实现建议：

- 第一版不一定要接完整富文本编辑器
- 可以先用“多行文本 + 上传图片后自动插入 HTML”方式落地
- 这样能复用现有 console 上传接口，成本最低

### 5.6 地点搜索交互补充

详细地址不再只靠人工填写。

建议交互：

- 输入详细地址关键词后
- 调用腾讯地图地点联想接口
- 在下拉面板中展示候选地点
- 用户点击某条地点后，自动回填：
  - `location_detail`
  - `longitude`
  - `latitude`
  - 必要时同步补齐区域信息

当前仓库里已有可复用实现：

- `console/src/pages/CourseFormPage.tsx`
- `backend/console-api/routes/courses.js`
- `backend/console-api/services/tencentMapService.js`

建议 package 表单直接复用课程表单里的联想搜索方案，不要重新发明一套地图搜索逻辑。

### 5.7 图片字段口径补充

本轮已确认：

- 课包不需要轮播图
- 封面图与课包详情顶部展示使用同一张图

因此建议：

- 新建/编辑课包表单移除“课包轮播图”上传区
- `images` 不再作为后台主输入项
- 小程序详情顶部如果当前仍依赖 `images`，应改为优先使用 `cover`

如为兼容历史接口，需要短期保留 `images` 字段，建议处理为：

- 服务端写入时可自动把 `cover` 同步成单元素数组 `images = [cover]`
- 或者读取层统一把缺失 `images` 的情况回退到 `cover`

### 5.8 类型调整

`console/src/types.ts` 中的 `PackageListItem` / `PackageDetail` 需要补充：

- `class_count: number`
- `class_duration_minutes: number`
- `group_price_config: Array<{ target_count: number; price_fen: number }>`
- `publish_time: string`
- `unpublish_time: string`
- `status: 'pending' | 'active' | 'inactive'`

## 6. 后台接口与服务层改造

## 6.1 主要改造文件

- `backend/console-api/services/packageAdminService.js`
- `backend/repositories/coursePackagesRepository.js`

### 6.2 `packageAdminService` 需要做的事

1. 在 `validatePackagePayload` 中新增字段校验：
   - `class_count`
   - `class_duration_minutes`
   - `group_price_config`
   - `publish_time`
   - 富文本介绍非空
   - 富文本教练简介非空
2. 在 `mapPackagePayloadToDb` 中新增映射：
   - `class_count -> class_count`
   - `class_duration_minutes -> class_duration_minutes`
   - `group_price_config -> group_price_config`
   - `publish_time -> publish_time`
   - `unpublish_time -> unpublish_time`
3. 在写库前，根据 `group_price_config` 自动生成：
   - `supported_people`
4. 新建时根据 `publish_time` 自动推导初始状态：
   - 未到时间：`pending`
   - 已到时间：`active`
5. 增加后台“下架”动作服务：
   - 仅允许 `pending` / `active` 执行
   - 执行后更新为 `inactive`
   - 写入 `unpublish_time`
   - 返回明确的下架结果
6. 在 admin 返回的 `mapPackageListItem` / `mapPackageDetail` 中补充输出：
   - `class_count`
   - `class_duration_minutes`
   - `group_price_config`
   - `publish_time`
   - `unpublish_time`
   - 三态状态文案
7. 管理后台日志 `detail` 中建议同步记录新字段，避免后续审计信息缺失。
8. 增加 package 版地点联想接口复用，或直接复用课程地点联想接口。
9. 如果继续保留 `images` 字段兼容旧接口，应统一约定其与 `cover` 的同步策略。

### 6.3 状态相关建议方法

建议新增：

- `normalizePackageStatus(value)`
- `resolvePackageStatus({ status, publishTime, now })`
- `canOfflinePackage(status)`

职责分别是：

- 规范内部状态值
- 统一计算展示态 / 实际可见态
- 判断当前课包是否允许下架

### 6.4 推荐的辅助方法

建议新增：

- `normalizeGroupPriceConfig(value)`
- `deriveSupportedPeopleFromGroupPriceConfig(config)`
- `findGroupPriceFen(config, targetCount)`

职责分别是：

- 规范化并排序 `group_price_config`
- 派生 `supported_people`
- 统一查询某个团型的人均价格

## 7. Repository / 数据库存储改造

## 7.1 主要文件

- `backend/repositories/coursePackagesRepository.js`
- 相关 migration SQL 文件

### 7.2 Repository 需要改的点

`PACKAGE_SELECT_FIELDS` 增加：

- `class_count`
- `class_duration_minutes`
- `group_price_config`
- `publish_time`
- `unpublish_time`

`normalizePackage` 增加解析：

- `class_count: Number(row.class_count) || 0`
- `class_duration_minutes: Number(row.class_duration_minutes) || 0`
- `group_price_config: parseJsonField(row.group_price_config) || []`
- `publish_time: row.publish_time || null`
- `unpublish_time: row.unpublish_time || null`

`createPackage` / `updatePackage` 增加写入：

- `class_count`
- `class_duration_minutes`
- `group_price_config` 序列化为 JSON
- `publish_time`
- `unpublish_time`

图片字段兼容建议：

- 若产品已确认“无轮播图”，则长期建议弱化 `images`
- 兼容期可采用：
  - 写入时 `images = [cover]`
  - 或读取时无 `images` 则回退 `cover`

### 7.3 数据库迁移建议

建议新补一份 migration，而不是直接改旧初始化 SQL 作为唯一变更依据。

核心 SQL 方向：

```sql
ALTER TABLE course_packages
  ADD COLUMN class_count INT NOT NULL DEFAULT 0 AFTER total_price,
  ADD COLUMN class_duration_minutes INT NOT NULL DEFAULT 0 AFTER class_count,
  ADD COLUMN group_price_config JSON NULL AFTER supported_people,
  ADD COLUMN publish_time DATETIME NULL AFTER deadline_hours,
  ADD COLUMN unpublish_time DATETIME NULL AFTER publish_time;
```

如果当前 MySQL 版本或 CloudBase 兼容层对 `JSON` 字段有限制，也可退一步使用 `TEXT` 存储 JSON 字符串，但 Repository 仍按 JSON 结构输出。

## 8. 小程序读取接口调整

## 8.1 主要文件

- `backend/shared/services/packageReaders.js`

### 8.2 详情接口需要补充返回

`fetchMiniProgramPackageDetail` 建议新增：

- `class_count`
- `class_duration_minutes`
- `group_price_config`

并把当前依赖总价推导的金额逻辑，逐步改成读取配置值。

另外需要同步调整详情主图逻辑：

- 当课包无轮播图时，详情页顶部直接展示 `cover`
- 不再要求后台单独维护 `images`

### 8.3 列表接口建议

`fetchMiniProgramPackageList` 当前首页“人均价”仍按：

- `max(supported_people)`
- `total_price / max_supported_people`

方案 A 下，建议改为：

1. 从 `group_price_config` 中找到 `target_count` 最大的一项
2. 直接取其 `price_fen`

这样前台首页“8人团人均 ¥XX”就与后台配置完全一致。

### 8.4 小程序可见性规则

小程序首页课程列表只应展示：

- `active`

不应展示：

- `pending`
- `inactive`

但拼团详情页访问规则需要单独处理：

- 若课包已 `inactive`，但用户访问的是该课包下已成团的拼团详情，仍允许查看

也就是说，课包“首页不可见”不等于“拼团详情不可访问”。

建议实现时把“课包是否允许出现在首页”和“拼团详情是否允许查看”拆成两套判断，不要共用同一个简单状态拦截。

## 9. 支付与拼团金额计算调整

## 9.1 关键风险

当前真实支付金额仍来自：

- `backend/shared/domain/packageGroupRules.js`
- `calculatePackageMemberAmountFen({ totalPrice, targetCount })`

现逻辑是：

```js
Math.floor(totalPrice / targetCount)
```

这与方案 A 已冲突。

### 9.2 目标口径

实际支付金额必须改为：

- 从 `pkg.group_price_config` 中按 `target_count` 精确匹配 `price_fen`

也就是说：

- 开团下单金额：按所选团型查 `group_price_config`
- 参团下单金额：按当前团的 `target_count` 查 `group_price_config`
- 课程详情页各团型价格：按 `group_price_config` 展示
- 后台拼团列表/订单列表的金额说明：也应走相同口径

### 9.3 推荐改法

保留 `calculatePackageMemberAmountFen` 这个函数名并不理想，因为它当前语义已经绑定“总价平摊”。

推荐拆成两层：

1. 新增基于配置查价的方法，例如：
   - `resolvePackageMemberAmountFen({ groupPriceConfig, targetCount })`
2. 所有 package 下单、详情、列表金额都调用这个新方法

受影响文件至少包括：

- `backend/shared/domain/packageGroupRules.js`
- `backend/shared/services/packageOrders.js`
- `backend/shared/services/packageReaders.js`
- `backend/console-api/services/packageAdminService.js`

### 9.4 下架后的订单/拼团处理

产品口径已确认：

- 下架操作后，如课程存在未完成拼团，需要“原价退回”

这里建议下一个 AI 先和代码实现再确认一次“原价退回”的精确定义，至少要明确：

1. 是按用户实付金额原路退回
2. 还是按 `total_price_fen` / 某种运营口径退款

从支付系统常规口径看，更合理的是：

- 对未完成拼团中所有已支付订单，按订单实付金额退款

建议文案里的“原价退回”理解为：

- 全额退回用户已支付金额

不要直接实现成“退整个课程总价”。

另外，下架动作建议至少联动以下处理：

- 把该课包下仍处于 `active` 的 `package_groups` 标记为 `failed`
- 对这些团下已支付且未退款的订单发起退款
- 写后台操作日志
- 保留已成团 `package_groups` 和其详情查看能力

## 10. 兼容与迁移建议

### 10.1 兼容旧数据

线上或本地已有旧课包数据时，新增字段后会出现“历史数据为空”的问题。

建议迁移策略：

1. 结构迁移先执行
2. 对已有 `course_packages` 进行一次数据回填

可接受的临时回填策略：

- `class_count = 5`
- `class_duration_minutes = 60`
- `publish_time` 为空时，可按历史创建时间或当前时间回填
- `group_price_config` 按现有 `supported_people + total_price` 自动生成

例如：

```json
supported_people = [4, 6, 8]
total_price = 198000
```

可临时回填为：

```json
[
  { "target_count": 4, "price_fen": 49500 },
  { "target_count": 6, "price_fen": 33000 },
  { "target_count": 8, "price_fen": 24750 }
]
```

但这只是兼容兜底，不是最终运营口径。后续仍建议运营重新录入真实团型价格。

### 10.2 当前前端临时兜底说明

目前小程序端已经存在前端临时兜底，不应误认为后端已支持真实字段：

- `miniprogram/utils/package.js`

已知临时行为：

- `featureTags` 默认兜底为 `5节课 / 60分钟 / 上课时间家长定`
- `supportedGroupPriceList` 当前硬编码为 `4:500 / 6:400 / 8:300`

后续当后端字段打通后，应优先改成读真实接口数据，再删除前端硬编码兜底。

当前 console 端也已有可直接复用的能力：

- 课程表单中已有“腾讯地图地点联想搜索”
- 课程表单中已有“上传图片并插入介绍内容”的实现雏形

建议 package 表单优先复用这两块能力，而不是重新从零搭建。

## 11. API 口径建议

## 11.1 后台 create/update payload

建议最终写成：

```json
{
  "name": "周末体适能课程",
  "package_category": "体适能",
  "cover": "https://...",
  "total_price_fen": 198000,
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [
    { "target_count": 4, "price_fen": 50000 },
    { "target_count": 6, "price_fen": 40000 },
    { "target_count": 8, "price_fen": 30000 }
  ],
  "supported_people": [4, 6, 8],
  "location_district": "南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "coach_name": "教练A",
  "coach_intro": "<p>简介</p><img src=\"https://...\" />",
  "coach_certificates": ["https://..."],
  "description": "<p>...</p><img src=\"https://...\" />",
  "publish_time": "2026-04-22 10:00:00"
}
```

说明：

- 服务端应优先相信 `group_price_config`
- `supported_people` 可以允许前端不传，服务端自行派生
- `status` 不建议由新建接口直接信任前端传入
- `publish_time` 应为新建接口必填
- 下架应走独立动作接口，而不是靠编辑接口直接改状态
- `cover` 是唯一主图来源
- `description` 与 `coach_intro` 需要支持富文本图片内容

## 11.2 小程序详情响应

建议在现有响应上新增：

```json
{
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [
    { "target_count": 4, "price_fen": 50000 },
    { "target_count": 6, "price_fen": 40000 },
    { "target_count": 8, "price_fen": 30000 }
  ]
}
```

## 12. 推荐实施顺序

建议按下面顺序改，能减少联调来回返工：

1. 加 migration，扩展 `course_packages`
2. 改 `coursePackagesRepository`
3. 改 `packageAdminService` 校验、映射、返回
4. 加入课包三态状态机与下架动作
5. 改 `console/src/types.ts`
6. 改 `PackageFormPage.tsx` 表单 UI
7. 复用课程表单的腾讯地图联想搜索到 package 表单
8. 给 `description` 和 `coach_intro` 接入图片上传插入能力
9. 移除 package 表单里的“轮播图”输入区，统一改为 `cover`
10. 改 `console/src/pages/PackageListPage.tsx` 列表筛选、状态文案、下架确认弹窗
11. 改 `packageReaders.js`
12. 改 `packageGroupRules.js` 与 `packageOrders.js` 的金额口径
13. 处理下架后的拼团失败与退款链路
14. 把小程序前端临时硬编码切到真实接口
15. 更新文档：
   - `docs/miniprogram/prd2.0md.md`
   - `docs/miniprogram/2026-04-19-package-group-tech-design.md`
   - `docs/miniprogram/2026-04-19-package-group-api.md`

## 13. 需要同步修改的文件清单

直接相关：

- `console/src/pages/PackageFormPage.tsx`
- `console/src/pages/CourseFormPage.tsx`
- `console/src/pages/PackageListPage.tsx`
- `console/src/types.ts`
- `backend/console-api/services/packageAdminService.js`
- `backend/console-api/services/tencentMapService.js`
- `backend/console-api/routes/courses.js`
- `backend/repositories/coursePackagesRepository.js`
- `backend/shared/services/packageReaders.js`
- `backend/shared/services/packageOrders.js`
- `backend/shared/domain/packageGroupRules.js`
- `backend/repositories/packageGroupsRepository.js`

高概率需要改：

- 相关 migration SQL
- console 端 package 列表 / 详情展示页
- 小程序课程详情页数据适配
- 小程序首页课程卡片价格展示逻辑

文档需要同步：

- `docs/miniprogram/prd2.0md.md`
- `docs/miniprogram/2026-04-19-package-group-tech-design.md`
- `docs/miniprogram/2026-04-19-package-group-api.md`

## 14. 测试建议

至少覆盖以下场景：

1. 后台新建课程，填入 3 组团型价格，保存成功
2. 新建课程时只填上架时间，不手选状态；保存后未到上架时间显示 `待上架`
3. 到达上架时间后，课程自动表现为 `已上架`
4. 后台编辑课程，修改某个团型价格后再次保存成功
5. 后台返回的 `supported_people` 与 `group_price_config.target_count` 一致
6. package 表单输入详细地址时，可调用腾讯地图联想并自动回填坐标
7. `description` 可上传图片并成功插入内容
8. `coach_intro` 可上传图片并成功插入内容
9. package 表单不再维护“轮播图”，只维护 `cover`
10. 小程序首页只展示 `已上架` 课程
11. 小程序课程详情显示真实的节数、课时长、团型价格
12. 发起 4 人团订单，金额等于 `group_price_config` 中 4 人团价格
13. 参与 6 人团订单，金额等于 `group_price_config` 中 6 人团价格
14. 对 `待上架` / `已上架` 课程执行下架时出现二次确认弹窗
15. 下架后课程不再出现在首页，但已成团拼团详情页仍可访问
16. 下架含未完成拼团的课程时，相关订单能走退款链路
17. 当某团型未配置价格时，服务端明确报错，而不是回退到总价平摊

## 15. 对下一个 AI 的提醒

1. 这是一次“正式字段补齐 + 金额口径切换”改造，不只是后台表单加三个输入框。
2. 当前仓库里有其他未提交改动，实施时不要回滚无关文件。
3. 当前小程序端有临时硬编码兜底，后端字段打通后要记得清理。
4. `supported_people` 需要保留兼容，但不应继续作为真值来源。
5. 真正高风险点在支付金额链路，不在 UI 表单本身。
6. 课包“状态可见性”和“拼团详情可访问性”是两套规则，不能混在一起实现。
7. package 表单已有两块能力可直接复用课程表单：腾讯地图联想搜索、上传图片插入富文本。
