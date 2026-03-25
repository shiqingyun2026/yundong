# 邻动体适能小程序 技术设计文档

| 文档版本 | 修改日期 | 修改人 | 修改内容 |
| ---- | ---------- | ----- | ---- |
| V1.0 | 2026-03-20 | 技术负责人 | 初版创建 |
| V1.1 | 2026-03-25 | 技术负责人 | 根据当前小程序实现同步更新：新增协议页、支付结果页、我的拼团页；移除手机号授权；支付改为模拟支付；补充 mock 降级策略与本地后端结构 |
| V1.2 | 2026-03-25 | 技术负责人 | 同步当前真实联调状态：后端改为 Express + Supabase；新增 mock 支付成功接口；统一课程/拼团字段口径与活跃拼团模型 |

## 1. 技术架构概述

### 1.1 当前整体架构

当前系统采用“微信原生小程序前端 + 本地 Node.js/Express 后端 + Supabase(PostgreSQL)”的开发架构：

* **前端**：微信小程序原生框架，负责页面渲染、用户交互、调用微信原生能力（登录、定位、分享、图片预览）。
* **后端**：Node.js + Express，提供 RESTful API，处理登录、课程、拼团、订单、模拟支付等业务逻辑。
* **数据库**：Supabase（PostgreSQL），后端通过 `@supabase/supabase-js` 访问。
* **本地开发地址**：`http://127.0.0.1:8000`
* **降级策略**：前端采用“真实接口优先，网络不可用时自动回退 mock 数据”的机制；若后端已明确返回 `401/403/500` 等错误，则不再静默回退 mock，便于联调排查。

### 1.2 前端技术选型

| 组件 | 当前方案 | 说明 |
| ---- | ---- | ---- |
| 前端框架 | 微信小程序原生框架 | 满足性能与原生能力调用需求 |
| 样式方案 | `wxss` + 全局基础样式 | 结合页面级样式与通用卡片能力 |
| 请求层 | `utils/request.js` | 统一封装 `baseURL`、token 注入、错误处理 |
| 登录封装 | `utils/auth.js` | 统一处理 `wx.login`、`wx.getUserProfile`、稳定 `mockOpenId` |
| 业务数据封装 | `utils/course.js` | 封装课程、拼团、订单、支付相关真实接口与 mock 兜底 |
| 组件 | 原生自定义组件 | 当前包含 `loading-view`、`empty-state`、`base-modal` |

### 1.3 后端技术选型

| 组件 | 当前方案 | 说明 |
| ---- | ---- | ---- |
| 运行时 | Node.js | 本地轻量开发 |
| Web 框架 | Express | 路由清晰，便于快速联调 |
| 数据库 | Supabase (PostgreSQL) | 通过 `@supabase/supabase-js` 访问 |
| 鉴权 | JWT Bearer Token | `jsonwebtoken` 签发，`Authorization: Bearer <token>` |
| 环境变量 | dotenv | 管理 `PORT / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / JWT_SECRET` |

### 1.4 当前核心业务流程

1. 小程序启动后先检查协议同意状态，未同意则强制进入协议页。
2. 用户可未登录浏览首页和课程详情。
3. 用户在“我的”页点击登录，前端通过 `wx.getUserProfile + wx.login` 获取头像昵称和 `code`，请求后端 `/api/auth/login`。
4. 为避免本地联调时每次登录生成新用户，前端会额外带上稳定 `mockOpenId`。
5. 首页获取定位并请求课程列表；若网络不可用则回退默认坐标和 mock 数据。
6. 课程详情页请求课程详情和当前进行中的拼团信息。
7. 用户从详情页点击“立即开团/去参团”时，先调用 `POST /api/orders` 创建订单。
8. 支付确认页请求课程信息和可选的拼团信息；当前仍使用模拟支付，不调起真实微信支付。
9. 用户点击确认支付后，前端调用 `POST /api/payments/mock-success` 更新订单状态与拼团状态。
10. 支付结果页再进入拼团详情页，查看实时拼团状态。
11. “我的拼团”列表页展示当前用户参与的拼团，并支持状态筛选、倒计时、下拉刷新、上拉加载更多。

## 2. 小程序目录与页面结构

### 2.1 页面路由

当前 `app.json` 已注册的页面如下：

| 页面路径 | 说明 |
| ---- | ---- |
| `pages/agreement/index` | 启动协议页 |
| `pages/home/index` | 首页课程列表 |
| `pages/course/detail/index` | 课程详情页 |
| `pages/payment/confirm/index` | 支付确认页 |
| `pages/payment/result/index` | 支付结果页 |
| `pages/group/detail/index` | 拼团详情页 |
| `pages/my/group-buy-list/index` | 我的拼团列表页 |
| `pages/mine/index` | 我的页面 |

### 2.2 TabBar

当前底部 TabBar 仅保留两个入口：

* 首页：`pages/home/index`
* 我的：`pages/mine/index`

### 2.3 公共组件

| 组件路径 | 说明 |
| ---- | ---- |
| `components/loading/index` | 通用加载态 |
| `components/empty-state/index` | 通用空状态 |
| `components/base-modal/index` | 通用弹窗，用于客服二维码等场景 |

## 3. 前端全局状态与公共能力

### 3.1 `app.js` 全局状态

当前 `app.js` 中的 `globalData` 主要包括：

| 字段 | 说明 |
| ---- | ---- |
| `baseURL` | 接口基础地址，当前为 `http://127.0.0.1:8000` |
| `token` | 登录 token |
| `userInfo` | 用户基础信息，仅包含头像、昵称等 |
| `location` | 当前定位信息 |
| `agreementAccepted` | 协议是否已同意 |
| `pendingOrder` | 当前待处理订单上下文 |
| `forceMock` | 可选 mock 强制开关，默认不启用 |
| `systemInfo` | 小程序设备信息 |
| `navbarHeight` | 自定义导航相关高度 |

### 3.2 当前全局方法

| 方法 | 说明 |
| ---- | ---- |
| `setAgreementAccepted` | 写入协议同意状态并持久化 |
| `ensureAgreementAccepted` | 启动时守卫协议页 |
| `setUserInfo` | 同步用户信息到全局和本地缓存 |
| `setToken` | 同步 token 到全局和本地缓存 |
| `setLocation` | 同步定位到全局和本地缓存 |

### 3.3 请求封装 `utils/request.js`

请求层统一实现了：

* 从 `app.globalData.baseURL` 读取基础地址
* 自动拼接完整 URL
* 自动读取 `wx.getStorageSync('token')`，追加 `Authorization: Bearer <token>`
* 对真实后端错误保留原始状态码与 `message`
* HTTP 401 时自动清理本地 token，并同步清空 `app.globalData.token`
* 默认错误 toast 提示
* 控制台输出请求开始、成功、失败日志，便于联调排查

当前导出方法：

* `request`
* `get`
* `post`
* `put`
* `del`

## 4. 当前业务模块实现

### 4.1 协议页

* 页面：`pages/agreement/index`
* 数据来源：本地静态富文本
* 逻辑：
  * 首次启动强制展示
  * 用户勾选“我已阅读并同意”后才可进入首页
  * 拒绝时提示“您需要同意协议才能使用本小程序”
  * 支持环境下调用 `wx.exitMiniProgram`，不支持时停留在协议页

### 4.2 登录

* 页面入口：`pages/mine/index`
* 当前登录方式：
  * `wx.getUserProfile`
  * `wx.login`
  * `POST /api/auth/login`
* 当前只保留：
  * `nickName`
  * `avatarUrl`
  * `token`
* 已明确移除：
  * 手机号授权
  * `wx.getPhoneNumber`
  * 手机号本地存储和绑定流程

### 4.3 首页课程列表

* 页面：`pages/home/index`
* 核心能力：
  * 自动定位
  * 顶部定位栏可重新定位
  * Tab 切换：全部课程 / 最近开课
  * 下拉刷新
  * 上拉加载更多
  * 首页卡片倒计时展示
* 当前产品口径：
  * 课程名称使用 `name`
  * 上课时间仅展示 `start_time`
  * 价格按“元”展示，不做分转元
  * “已拼人数”“即将成团”“倒计时”统一基于 `activeGroup`
  * 若无 `activeGroup`，则不展示人数和倒计时

### 4.4 课程详情

* 页面：`pages/course/detail/index`
* 展示内容：
  * 轮播图
  * 课程信息卡片
  * 课程介绍
  * 拼团规则
  * 教练信息
  * 保险说明
  * 当前拼团状态展示
* 当前产品口径：
  * `x人成团`、`已拼x人`、倒计时都基于 `activeGroup`
  * 无活跃拼团时隐藏人数并显示“立即开团”
  * 拼团模块不展示成员头像
  * 主操作统一保留在底部固定栏

### 4.5 支付确认与支付结果

* 支付确认页：`pages/payment/confirm/index`
* 支付结果页：`pages/payment/result/index`
* 当前实现：
  * 订单信息展示来自课程与拼团数据
  * 必须勾选课程协议才能继续
  * 当前支付为模拟支付，不调用 `wx.requestPayment`
  * 若未创建订单，则点击确认支付时先调用 `POST /api/orders`
  * 模拟支付成功后再调用 `POST /api/payments/mock-success`
  * 成功跳转支付结果页 `status=success`
  * 失败跳转支付结果页 `status=fail`

### 4.6 拼团详情

* 页面：`pages/group/detail/index`
* 展示内容：
  * 状态标签
  * 完整课程信息
  * 拼团进度
  * 成员列表
  * 底部操作区
* 分享逻辑：
  * 使用微信原生分享
  * 分享成功后仅 `wx.showToast({ title: '分享成功', icon: 'success', duration: 2000 })`
  * 不弹额外模态框，不跳转
* 访问控制：
  * 仅拼团成员允许访问详情页

### 4.7 我的页面与我的拼团

* “我的”页面：`pages/mine/index`
  * 未登录显示“点击登录”
  * 已登录显示头像昵称
  * 支持退出登录
  * 当前只保留“我的拼团”“联系客服”核心入口
* 我的拼团列表：`pages/my/group-buy-list/index`
  * 状态筛选：全部、进行中、已成团、已失败
  * 进行中支持倒计时
  * 支持下拉刷新和上拉加载更多

## 5. 当前后端结构

### 5.1 后端目录

当前项目根目录下已生成 `backend/` 本地后端，主要结构如下：

| 路径 | 说明 |
| ---- | ---- |
| `backend/server.js` | 服务入口 |
| `backend/middleware/auth.js` | JWT 鉴权中间件 |
| `backend/utils/supabase.js` | Supabase 客户端初始化 |
| `backend/routes/auth.js` | 登录接口 |
| `backend/routes/courses.js` | 课程列表 / 课程详情 / 当前拼团 |
| `backend/routes/groups.js` | 拼团详情 |
| `backend/routes/user.js` | 用户拼团列表 |
| `backend/routes/orders.js` | 创建订单（开团/参团） |
| `backend/routes/payments.js` | mock 支付成功回调 |

### 5.2 当前数据表

当前 Supabase 后端已联调的数据表：

| 表名 | 说明 |
| ---- | ---- |
| `users` | 用户表 |
| `courses` | 课程表 |
| `groups` | 拼团表 |
| `group_members` | 拼团成员表 |
| `orders` | 订单表 |

### 5.3 当前字段与状态口径

当前拼团状态使用字符串：

| 状态值 | 说明 |
| ---- | ---- |
| `active` | 进行中 |
| `success` | 已成团 |
| `failed` | 已失败 |

前端展示层当前会把 `active` 映射为 `ongoing`。

订单当前主要状态：

| 状态值 | 说明 |
| ---- | ---- |
| `created` | 已创建，待支付确认 |
| `success` | 已支付成功 |

关键字段口径：

* 课程名称：`courses.name`
* 课程地址：`courses.address`
* 适用年龄：`courses.age_limit`
* 保险说明：`courses.insurance_desc`
* 客服二维码：`courses.service_qr_code`
* 当前人数：`groups.current_count`
* 成团人数：`groups.target_count`
* 拼团截止时间：`groups.expire_time`
* 课程表不再维护 `joined_count` / `target_count`

## 6. 接口设计

### 6.1 当前接口基础信息

* **基础地址**：`http://127.0.0.1:8000`
* **认证方式**：Bearer Token
* **返回风格**：当前后端以直接返回业务 JSON 为主，错误时返回标准 HTTP 状态码与 `{ message }`

### 6.2 已落地接口

#### 6.2.1 登录

* **URL**：`POST /api/auth/login`
* **请求参数**：

```json
{
  "code": "wx_login_code",
  "mockOpenId": "mock_user_xxx"
}
```

说明：

* 前端当前会传 `code`
* 也会附带 `mockOpenId` 作为本地稳定身份辅助字段

#### 6.2.2 首页课程列表

* **URL**：`GET /api/courses`
* **Query 参数**：
  * `lat`
  * `lng`
  * `sort`：`distance` / `time`
  * `page`
  * `pageSize`
* **当前返回重点**：
  * 课程基础信息
  * `activeGroup`
    * `groupId`
    * `currentCount`
    * `targetCount`
    * `expireTime`

#### 6.2.3 课程详情

* **URL**：`GET /api/courses/:id`

#### 6.2.4 当前进行中的拼团

* **URL**：`GET /api/courses/:id/active-group`

#### 6.2.5 拼团详情

* **URL**：`GET /api/groups/:id`
* **认证**：需要 token
* **访问控制**：仅拼团成员允许访问

#### 6.2.6 用户拼团列表

* **URL**：`GET /api/user/groups`
* **认证**：需要 token
* **Query 参数**：
  * `status`
  * `page`
  * `pageSize`

#### 6.2.7 创建订单

* **URL**：`POST /api/orders`
* **认证**：需要 token
* **请求参数**：

```json
{
  "courseId": "course-101",
  "groupId": "group-101"
}
```

说明：

* 开团时 `groupId` 可为空
* 参团时传入当前进行中的拼团 `groupId`

#### 6.2.8 mock 支付成功

* **URL**：`POST /api/payments/mock-success`
* **认证**：需要 token
* **请求参数**：

```json
{
  "orderId": "order-xxx",
  "groupId": "group-xxx"
}
```

* **当前行为**：
  * 更新 `orders.status = 'success'`
  * 若订单关联拼团，则校验成员关系
  * 必要时补写 `group_members`
  * 必要时更新 `groups.current_count`
  * 达到成团人数后更新 `groups.status = 'success'`

## 7. mock 降级策略

### 7.1 原则

前端当前采用“真实接口优先，网络不可用时降级 mock”的策略，保证本地无后端、网络异常等情况下仍能演示完整流程。

### 7.2 已覆盖的接口降级

| 接口 | 降级情况 |
| ---- | ---- |
| `POST /api/auth/login` | 已支持 mock token 和 mock 用户信息 |
| `GET /api/courses` | 已支持 mock 课程列表 |
| `GET /api/courses/:id` | 已支持 mock 课程详情 |
| `GET /api/courses/:id/active-group` | 已支持 mock 进行中拼团 |
| `GET /api/groups/:id` | 已支持 mock 拼团详情 |
| `GET /api/user/groups` | 已支持 mock 我的拼团列表 |
| `POST /api/orders` | 已支持 mock 创建订单 |

补充说明：

* `POST /api/payments/mock-success` 当前要求真实后端可用，不提供前端 mock 回退
* 对 `401/403` 等鉴权错误，前端不再自动切 mock，而是引导用户重新登录

### 7.3 mock 数据统一位置

当前 mock 业务数据主要集中在：

* `utils/course.js`
* `utils/auth.js`

## 8. 页面稳定性处理

以下页面已补充“页面卸载后不再执行 UI 更新”的保护：

| 页面 | 处理 |
| ---- | ---- |
| `pages/home/index` | 页面级倒计时定时器延迟启动与清理 |
| `pages/course/detail/index` | `_isAlive` + 倒计时延迟启动 + `safeSetData` |
| `pages/payment/confirm/index` | `_isAlive` + 定时器清理 + `safeSetData` |
| `pages/payment/result/index` | `_isAlive` + 定时器清理 + `safeSetData` |
| `pages/group/detail/index` | `_isAlive` + 定时器清理 + `safeSetData` |

统一约束：

* `onUnload` 中清理所有 `setTimeout / setInterval`
* 异步回调中先判断 `_isAlive`
* 避免页面销毁后继续 `setData`、toast 或跳转

## 9. 本地开发说明

### 9.1 前端

* 使用微信开发者工具打开项目根目录
* 已开启开发环境“不校验合法域名”
* `baseURL` 当前配置为 `http://127.0.0.1:8000`

### 9.2 后端

启动方式：

```bash
cd /Users/yun/lindong/backend
npm install
node server.js
```

启动后可通过以下接口验证：

* `GET /health`
* `POST /api/auth/login`
* `GET /api/courses`

### 9.3 当前联调建议

建议按以下顺序验证：

1. 启动后端，确认 `/health` 可访问
2. 在“我的”页完成登录，确认 token 写入本地
3. 打开首页验证课程列表、活跃拼团信息和倒计时
4. 进入课程详情验证详情与当前拼团
5. 进入支付确认页验证订单信息、创建订单和 mock 支付成功回写
6. 进入支付结果页和拼团详情页验证跳转链路与人数刷新
7. 在“我的拼团”验证状态筛选、刷新与分页

## 10. 后续技术演进建议

当前技术文档记录的是“已实现 / 正在联调”的实际状态，后续建议再按正式上线版本逐步补齐：

* 真实微信支付接入
* 支付回调与订单状态闭环
* 拼团失败自动退款任务
* 后台课程管理 / 订单管理 / CMS
* 订单与拼团更新的一致性事务化
* 生产环境 HTTPS 与对象存储接入
