# 体验课拼团方案设计

## 背景

当前小程序首页已支持按课包分类展示 `体适能`、`跳绳` 等课程，开团主链路基于现有课包拼团体系：

- 首页课包列表
- 课包详情
- 开团页
- 支付
- 拼团详情
- 我的拼团

本次需求是在首页新增一个独立同级 tab `体验课`，体验课仍然走拼团购买，但业务规则与正式课不同：

- 体验课只能购买 `1 节课`
- 用户开团时必须选择 `上课日期 + 开始时间`
- 上课日期最早只能是开团后第 `2` 天
- 可售开始时间与正式课一致，最早 `09:00`，最晚 `19:00`

## 目标

- 首页新增独立 `体验课` tab，只展示体验课课包
- 体验课继续复用现有课包拼团主链路，不新建一套订单/拼团模型
- 体验课开团时支持选择单次上课日期与开始时间
- 正式课原有多节课、周排课逻辑保持不变
- 运营后台可配置和管理体验课课包

## 非目标

- 不新建独立的体验课详情页、订单页、拼团页
- 不改正式课的周排课业务口径
- 不在本次内引入任意分钟级时间输入，仅支持离散开始时间
- 不调整支付、退款的基础流程

## 推荐方案

推荐基于现有 `package -> package group -> order` 体系扩展一种新的课包类型：`体验课`。

原因：

- 首页、详情、开团、支付、拼团结果页、我的拼团都可复用
- 改动集中在分类筛选、开团表单、后端创建开团校验和单节排课生成
- 对现有正式课主链路的侵入最小
- 与现有后台课包管理结构一致，后续运营维护成本更低

## 业务规则

### 课包分类

- 新增课包分类值：`体验课`
- 首页 `体验课` tab 只展示 `packageCategory = 体验课` 的课包

### 购买与排课

- 体验课仍然走拼团
- 体验课固定 `1 节课`
- 用户开团时选择：
  - 上课日期 `classDate`
  - 开始时间 `hour`
- `hour` 的可选范围与正式课一致，复用现有小时选项：
  - 最早 `09:00`
  - 最晚 `19:00`
- 上课日期校验：
  - `classDate >= 开团日期 + 2 天`

### 正式课兼容

- 正式课继续使用现有：
  - `targetCount`
  - `weekday`
  - `hour`
  - 多节课排课逻辑
- 体验课不使用 `weekday`
- 正式课不使用 `classDate`

## 用户链路

### 首页

1. 用户进入首页
2. 切换到 `体验课` tab
3. 首页展示体验课课包列表
4. 点击卡片进入现有课包详情页

### 课包详情

1. 用户查看体验课详情
2. 点击 `立即开团`
3. 进入现有开团页

### 开团页

1. 用户选择拼团人数
2. 用户选择上课日期
3. 用户选择开始时间
4. 填写学生昵称、年龄、家长手机号
5. 支付并开团

### 成团后

- 拼团详情页展示体验课的单次上课时间
- 我的拼团列表和详情继续沿用现有结构

## 前端方案

### 首页

涉及文件：

- [miniprogram/pages/home/index.js](/Users/yun/lindong/miniprogram/pages/home/index.js)
- [miniprogram/pages/home/index.wxml](/Users/yun/lindong/miniprogram/pages/home/index.wxml)

调整内容：

- 在 `HOME_TABS` 中新增 `体验课`
- 在 `filterPackageListByTab` 中增加 `packageCategory === '体验课'` 的筛选分支
- 首页卡片继续复用现有样式
- 体验课卡片文案适配单节课口径：
  - `包含1节课`
  - 避免使用“5次连续训练计划”等多节课文案

### 课包详情页

涉及文件：

- [miniprogram/pages/course/detail/index.js](/Users/yun/lindong/miniprogram/pages/course/detail/index.js)
- [miniprogram/pages/course/detail/index.wxml](/Users/yun/lindong/miniprogram/pages/course/detail/index.wxml)

调整内容：

- 继续复用现有详情页，不新建页面
- 增加 `isTrialPackage` 派生判断
- 对体验课调整文案：
  - 支持拼团区域显示为单节课口径
  - 拼团说明显示“成团后按所选日期与时间上课”
- 底部操作按钮仍为 `立即开团`

### 开团页

涉及文件：

- [miniprogram/pages/package/start/index.js](/Users/yun/lindong/miniprogram/pages/package/start/index.js)
- [miniprogram/pages/package/start/index.wxml](/Users/yun/lindong/miniprogram/pages/package/start/index.wxml)

这是本次前端主改动点。

建议在页面加载 `packageDetail` 后生成统一判断字段：

- `isTrialPackage`

判断优先级：

1. 后端返回显式类型字段
2. 兜底使用 `packageCategory === '体验课'`

#### 正式课模式

保持现有能力不变：

- 选择拼团人数
- 选择每周上课时间（星期 + 小时）
- 连续多节课说明文案

#### 体验课模式

将“选择每周上课时间”替换为：

- 选择上课日期
- 选择开始时间

表单建议：

- 日期控件：原生 `picker mode="date"`
- 时间控件：复用当前小时选项来源，仅允许离散时间值 `09:00` 到 `19:00`

提交参数：

- 正式课：
  - `targetCount`
  - `weekday`
  - `hour`
- 体验课：
  - `targetCount`
  - `classDate`
  - `hour`

体验课页面文案调整：

- “体验课仅 1 节，成团后按所选日期与开始时间上课”
- “最早可选日期为开团后第 2 天”

### 支付结果、拼团详情、我的拼团

涉及文件按实际读取结果补充展示分支。

展示原则：

- 不新建新页面
- 体验课优先展示 `上课日期 + 开始时间`
- 不再展示“连续 5 节课”的多节课口径

## 后端方案

重点同步两侧实现：

- [backend/lindong-api/shared/services/packageOrders.js](/Users/yun/lindong/backend/lindong-api/shared/services/packageOrders.js)
- [backend/console-api-service/shared/services/packageOrders.js](/Users/yun/lindong/backend/console-api-service/shared/services/packageOrders.js)

同时需要检查读取侧：

- package readers
- package admin readers
- group/detail 展示逻辑

原因：

- 小程序和后台共用/镜像了课包拼团规则
- 如果只改一侧，会导致创建、读取、展示口径不一致

### 接口策略

继续复用现有 `/api/package-orders/start`，不拆新接口。

原因：

- 小程序变更最小
- 能复用现有支付、订单、拼团状态流转
- 服务端可根据课包类型分支校验

### 创建开团规则

#### 正式课

继续使用现有规则：

- 必须提供 `weekday`
- 必须提供 `hour`
- 生成连续多节课排课

#### 体验课

新增规则：

- 必须提供 `classDate`
- 必须提供 `hour`
- `classDate` 不能早于开团后第 `2` 天
- `hour` 必须命中现有合法小时选项：`9` 到 `19`
- 固定只生成 `1` 节课

### 排课生成

正式课：

- 保持现有多节课生成逻辑

体验课：

- 只生成 `1` 条 lesson/schedule
- `schedule_text` 直接展示成单次课格式
- `schedule_list` 仅包含一条记录

建议展示格式：

- `06月08日 10:00`

### 服务端兜底校验

必须以后端校验为准，不依赖前端限制。

体验课服务端校验项：

- 课包分类必须为 `体验课`
- `class_count` 必须等于 `1`
- `classDate` 必填
- `hour` 必填
- `hour` 必须在 `9~19`
- `classDate >= 开团日期 + 2 天`
- 不接受 `weekday`

正式课服务端校验项：

- 必须有 `weekday`
- 必须有 `hour`
- 不接受 `classDate`

## 数据结构建议

### package 级别

优先最小改动，继续基于现有 package 表扩展。

建议复用或补充：

- `package_category`
  - 新增值：`体验课`
- `class_count`
  - 体验课固定为 `1`
- 可选新增 `schedule_mode`
  - `weekly_recurring`
  - `single_session`

### package group 级别

建议新增显式字段，避免仅靠文案字段承载真实业务数据：

- `selected_class_date`
- `selected_hour`

理由：

- 便于后台筛选与展示
- 便于后续扩展教练安排
- 比单纯依赖 `schedule_text` 更稳定

### schedule / lesson 级别

- 正式课：保持原有多条记录
- 体验课：仅生成一条记录

如果现有 lesson 生成逻辑强依赖首课时间，可在体验课模式下把所选 `classDate + hour` 映射为唯一的首课时间。

## 后台方案

前端：

- [console/src/pages/PackageFormPage.tsx](/Users/yun/lindong/console/src/pages/PackageFormPage.tsx)

后端：

- 课包创建/编辑服务
- 课包列表筛选
- 课包详情读取

调整内容：

- 课包分类支持选择 `体验课`
- 当分类为 `体验课` 时：
  - `class_count` 自动锁定为 `1`
  - 页面不展示正式课的多节课强配置文案
- 课包列表可按 `体验课` 筛选
- 拼团详情和后台订单详情可展示：
  - 所选上课日期
  - 所选开始时间

## 文案建议

### 首页卡片

- `包含1节课`
- 避免“连续训练计划”字样

### 开团页

正式课：

- `选择每周上课时间`

体验课：

- `选择上课日期`
- `选择开始时间`
- `体验课仅 1 节，成团后按所选日期与开始时间上课`
- `最早可选日期为开团后第 2 天`

### 拼团说明

体验课建议文案：

- `满员即成团`
- `拼团截止时间：开团后48小时`
- `未成团将自动原路退款`
- `成团后按所选日期与开始时间上课`

## 测试与验证范围

### 小程序

- 首页 `体验课` tab 只显示体验课课包
- 体验课详情可正常进入开团页
- 体验课开团页显示 `日期 + 开始时间`
- 早于开团后第 2 天的日期不能提交
- `09:00` 到 `19:00` 的时间可正常选择
- 体验课支付成功后，拼团详情可显示所选日期和开始时间
- 正式课原有开团流程不回归

### 后端

- 体验课创建开团成功
- 体验课缺少 `classDate` 时返回明确错误
- 体验课 `hour` 不在 `9~19` 时返回明确错误
- 体验课日期早于规则限制时返回明确错误
- 正式课仍要求 `weekday + hour`

### 后台

- 能创建 `体验课` 课包
- `class_count` 被锁定为 `1`
- 能按分类筛选体验课
- 拼团详情可看到体验课排课信息

## 风险与约束

### 风险一：分支逻辑散落

如果体验课判断散落在多个页面和 service 中，后续维护成本会明显升高。

控制方式：

- 前端统一使用 `isTrialPackage`
- 后端统一按 package 类型集中分支

### 风险二：双侧后端不一致

只改 `lindong-api` 不改 `console-api-service` 会导致后台与小程序数据口径不一致。

控制方式：

- 修改 shared service 时两侧同步检查

### 风险三：现有展示字段兼容

多个页面依赖 `schedule_text / schedule_list` 展示，多节课和单节课要兼容。

控制方式：

- 体验课也返回完整 `schedule_text + schedule_list`
- 只是在 `schedule_list` 中保留一条

### 风险四：后台误配置

如果后台未限制体验课 `class_count = 1`，后续容易出现错误配置。

控制方式：

- 后台 UI 限制
- 服务端保存前再次校验

## 实施顺序

1. 后台支持配置 `体验课` 分类，并锁定 `class_count = 1`
2. 小程序首页新增 `体验课` tab
3. 小程序开团页增加体验课模式：`日期 + 开始时间`
4. 后端 `/api/package-orders/start` 扩展体验课创建校验
5. 拼团详情、支付结果、我的拼团补体验课展示
6. 补充测试并做最小回归

## 成功标准

- 运营可在后台配置体验课课包
- 用户可从首页 `体验课` tab 进入体验课详情并发起开团
- 用户可选择合法的上课日期和开始时间
- 体验课开团后生成单节课排课数据
- 正式课链路不被破坏
