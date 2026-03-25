# 当前工作交接文档

## 1. 项目概况

项目：邻动体适能微信小程序  
工作目录：`/Users/yun/lindong`

当前技术形态：

* 小程序前端
* 本地后端：Express
* 数据存储：Supabase
* 联调地址：`http://127.0.0.1:8000`

本轮工作的核心主题：

* 拼团链路收口
* 多团课程支持
* 首页 / 课程详情 / 拼团详情三者职责重新划分
* 支付确认页协议拆分
* 文档同步


## 2. 当前已确认的产品口径

以下 3 条是当前必须当作既定口径继续开发的：

1. 首页课程卡片展示课程历史累计成功拼团人数。
2. 课程详情页若课程允许开多个团，则顶部不展示“已拼 X 人”。
3. 拼团详情页保持单团详情定位，不承接课程维度的多团聚合展示。

补充规则：

* 一个课程同一时刻仅允许一个进行中的拼团，但课程支持配置最大成团次数 `maxGroups`。
* 同一用户对同一课程只能成功参团一次。
* 创建订单但未支付时，不增加拼团人数，也不进入“我的拼团”。
* 只有支付成功后，才真正入团并更新人数。


## 3. 当前代码状态

### 3.1 已提交的重要 commit

近期明确提到的提交：

* `01927dc`
  `feat: refine home course group status display`
* `94ef188`
  `docs: update PRD for multi-group course flow`

注意：

* 当前工作区还有未提交文档：
  * [group-flow-lessons.md](/Users/yun/lindong/docs/group-flow-lessons.md)
  * [handoff.md](/Users/yun/lindong/docs/handoff.md)


### 3.2 当前关键产品逻辑落点

#### 首页课程卡片

主要文件：

* [courses.js](/Users/yun/lindong/backend/routes/courses.js)
* [course.js](/Users/yun/lindong/utils/course.js)
* [index.js](/Users/yun/lindong/pages/home/index.js)
* [index.wxml](/Users/yun/lindong/pages/home/index.wxml)

当前口径：

* 首页 `已拼人数` 展示课程历史累计成功拼团人数，即累计所有 `status='success'` 团的 `current_count`
* 首页倒计时仅在存在进行中的团时展示
* 首页课程列表请求已禁止默认 fallback 到 mock

后端列表接口 `GET /api/courses` 当前返回的重要字段：

* `maxGroups`
* `completedGroupsCount`
* `successJoinedCount`
* `activeGroup`


#### 课程详情页

主要文件：

* [courses.js](/Users/yun/lindong/backend/routes/courses.js)
* [course.js](/Users/yun/lindong/utils/course.js)
* [index.js](/Users/yun/lindong/pages/course/detail/index.js)
* [index.wxml](/Users/yun/lindong/pages/course/detail/index.wxml)
* [index.wxss](/Users/yun/lindong/pages/course/detail/index.wxss)

当前口径：

* 顶部 `已拼 X 人`
  * `maxGroups <= 1` 时可展示累计成功人数
  * `maxGroups > 1` 时不展示
* 拼团模块展示 `groupList`，即该课程所有团的状态列表
* 底部主按钮结合以下条件判断：
  * 是否存在进行中的团
  * 当前用户是否已在进行中的团中
  * `completedGroupsCount < maxGroups` 是否仍能继续开团

课程详情接口 `GET /api/courses/:id` 当前返回的重要字段：

* `maxGroups`
* `completedGroupsCount`
* `successJoinedCount`
* `activeGroup`
* `groupList`
* `descriptionHtml`


#### 拼团详情页

主要文件：

* [groups.js](/Users/yun/lindong/backend/routes/groups.js)
* [index.js](/Users/yun/lindong/pages/group/detail/index.js)
* [index.wxml](/Users/yun/lindong/pages/group/detail/index.wxml)

当前口径：

* 保持单团详情定位
* 当前版本不展示参团成员列表
* 分享仍基于单个 `groupId`
* 非成员访问仍会被接口拦截


#### 支付确认页与协议

主要文件：

* [index.js](/Users/yun/lindong/pages/payment/confirm/index.js)
* [index.wxml](/Users/yun/lindong/pages/payment/confirm/index.wxml)
* [index.js](/Users/yun/lindong/pages/service-agreement/index.js)
* [index.wxml](/Users/yun/lindong/pages/service-agreement/index.wxml)
* [agreement.js](/Users/yun/lindong/utils/agreement.js)

当前口径：

* 支付确认页中的“课程服务协议”是独立页面
* 不再复用首次启动的用户协议页
* 当前服务协议内容为临时占位文本


#### 登录与多用户模拟

主要文件：

* [auth.js](/Users/yun/lindong/utils/auth.js)
* [index.js](/Users/yun/lindong/pages/mine/index.js)

当前口径：

* 支持 `USE_MOCK_USER`
* 支持通过 `MOCK_USER_ID` 模拟不同用户登录
* 适合 `user1 / user2 / user3 ...` 切换联调


## 4. 关键接口当前语义

### 4.1 `GET /api/courses`

用途：

* 首页课程列表

当前字段重点：

* `successJoinedCount`
  首页累计成功人数依赖它
* `activeGroup`
  首页倒计时依赖它


### 4.2 `GET /api/courses/:id`

用途：

* 课程详情页

当前字段重点：

* `maxGroups`
* `completedGroupsCount`
* `successJoinedCount`
* `groupList`
* `descriptionHtml`


### 4.3 `GET /api/courses/:id/active-group`

用途：

* 课程详情页辅助判断当前团 / 最近团状态

注意：

* 这个接口名叫 `active-group`
* 但当前实现中，在没有进行中的团时，会回退返回最近一个成功/失败团

这是一个**高风险语义点**。  
后续如果继续开发，容易误以为它只返回进行中团。


### 4.4 `GET /api/groups/:id`

用途：

* 拼团详情页（单团详情）

注意：

* 当前仍有权限控制
* 非成员访问返回 `403`


### 4.5 `POST /api/orders`

当前规则：

* 开团前校验是否仍有进行中的团
* 开团前校验是否已达 `maxGroups`
* 同一用户同一课程不能重复成功参团
* 创建订单时不增加人数


### 4.6 `POST /api/payments/mock-success`

当前规则：

* 支付成功后才写 `group_members`
* 支付成功后才更新 `groups.current_count`
* 这是“人数增长”的真实时机


## 5. 已知坑点

详细复盘文档见：

* [group-flow-lessons.md](/Users/yun/lindong/docs/group-flow-lessons.md)

这里给接手者一个浓缩版：

### 5.1 最大坑：产品口径容易反复

容易冲突的点：

* 首页人数到底看当前团还是累计
* 课程详情顶部人数是否展示
* 拼团详情到底是课程维度还是单团维度

如果继续开发前不先确认这三条，会继续反复改。


### 5.2 `active-group` 名称与语义不一致

这是当前最容易误用的接口。  
名字像“当前活跃团”，实际上可能返回最近成功团。


### 5.3 mock fallback 曾掩盖真实问题

首页课程列表之前允许 mock fallback，导致：

* 页面看起来正常
* 但数据可能是假的

现在课程列表已禁用默认 fallback。  
如果首页再显示怪数据，优先查真实后端返回。


### 5.4 支付成功才算入团，必须全链路理解一致

不要再把“创建订单”理解为“已参团成功”。


## 6. 本轮回归现状

### 6.1 已完成的接口级验证

已验证通过：

* 本地后端可正常启动
* `GET /health` 正常
* 首页课程列表可正常返回：
  * 多团课程：篮球课返回 `completedGroupsCount: 3`、`successJoinedCount: 18`、`activeGroup: null`
* 多团课程详情可正常返回：
  * 篮球课返回 `groupList`
  * `maxGroups: 6`
  * `successJoinedCount: 18`
* 单团课程详情可正常返回：
  * 回归测试课程返回 `maxGroups: 1`
  * `successJoinedCount: 2`
  * `descriptionHtml` 含 `<img>` 富文本
* 非成员访问 `GET /api/groups/:id` 会被 `403` 拦截


### 6.2 尚未完整做完的点

还缺少更完整的页面级回归，尤其是：

* 首页卡片实际 UI 是否严格按累计成功人数展示
* 多团课程详情顶部是否已隐藏人数
* 课程详情“所有团列表”视觉和状态是否完全正确
* 分享落地后是否仍然始终走单团详情链路
* 找到一个真实成员身份，正向验证一次 `GET /api/groups/:id` 的成功返回结构


## 7. 关键测试数据

### 7.1 多团课程样本

课程：

* `d59f6ee2-f8b3-4498-852c-ff6339a7621a`
  `少儿篮球训练营`

当前接口侧观察到：

* `maxGroups: 6`
* `completedGroupsCount: 3`
* `successJoinedCount: 18`
* `activeGroup: null`
* `groupList` 中有 3 个成功团


### 7.2 单团课程样本

课程：

* `5c65088d-9a6e-4f33-a191-e6c7b4de13ac`
  `[回归测试] 无活跃拼团课程`

当前接口侧观察到：

* `maxGroups: 1`
* `completedGroupsCount: 1`
* `successJoinedCount: 2`
* `activeGroup: null`
* `groupList` 中有 1 个成功团


## 8. 当前文档状态

已同步到 PRD 主体模块：

* [prd.md](/Users/yun/lindong/docs/prd.md)

重点已更新：

* `1.4 核心规则说明`
* `4.1.2 首页`
* `4.1.3 课程详情页`
* `4.1.4 开团/参团支付页`
* `4.1.4A 支付结果页`
* `4.1.5 拼团详情页（单团详情）`

注意：

* `docs/prd.md` 后半段仍残留一些旧口径的数据映射/验收描述，没有做全量一致性清扫
* `docs/development-plan.md`
* `docs/regression-checklist.md`
* `docs/tech.md`

这些文档后续都建议再统一更新一轮


## 9. 接手后建议优先做什么

### 9.1 第一优先级

做一轮页面级专项回归，验证这三条最终口径：

1. 首页看历史累计成功人数
2. 课程详情多团时顶部不展示人数
3. 拼团详情保持单团详情定位


### 9.2 第二优先级

清理 `GET /api/courses/:id/active-group` 的语义问题：

* 要么改名
* 要么改成只返回真正进行中的团
* 要么增加明确字段说明当前返回的是“active / latest”


### 9.3 第三优先级

统一文档残余口径，尤其是：

* `docs/development-plan.md`
* `docs/regression-checklist.md`
* `docs/tech.md`


## 10. 给下一个 AI 的一句话提醒

继续开发前，先确认当前要处理的是“课程维度”还是“单团维度”。  
这条如果没先定清楚，后面看到的大多数“人数不对”“按钮不对”“页面逻辑不对”，本质上都不是代码 bug，而是口径又混了。
