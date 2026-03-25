



| 文档版本 | 修改日期       | 修改人   | 修改内容                          |
| ---- | ---------- | ----- | ----------------------------- |
| V1.0 | 2026-03-24 | 技术负责人 | 初版创建，基于Supabase统一数据层，适配外网Web端 |



***



## 1. 技术架构概述



### 1.1 整体架构

运营后台与小程序共用同一个Supabase项目作为数据层，实现数据统一存储与实时同步。运营后台采用前后端分离架构，前端为React单页应用（SPA），后端为Node.js BFF（Backend For Frontend）服务，负责权限校验、数据聚合、敏感操作（退款等），并通过Supabase服务端密钥访问数据库。所有静态资源（图片、证书）使用Supabase Storage存储。



**架构图**：

```plain&#x20;text
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   小程序前端      │─────▶│   Supabase       │◀─────│  运营后台前端     │
│  (微信小程序)     │      │  (PostgreSQL+    │      │  (React SPA)     │
└──────────────────┘      │   Auth+Storage)  │      └──────────────────┘
         │                └────────┬─────────┘               │
         │                         │                         │
         │                         │                         │
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  小程序云函数     │      │  Node.js BFF     │      │  运营后台API      │
│  (可选Edge)      │      │  (Express)       │      │  (Express)       │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```



### 1.2 核心原则

* **统一数据源**：小程序与运营后台共享同一PostgreSQL数据库，保证数据实时一致。

* **权限分离**：小程序用户通过Supabase Row Level Security (RLS) 限制只能访问自身数据；运营后台管理员通过Node.js BFF进行身份校验，使用Supabase服务端密钥（`service_role`）执行高权限操作。

* **安全可控**：所有管理员操作记录日志（操作人、时间、内容），敏感操作（退款、删除账号）需二次确认。

* **外网可访问**：运营后台前端部署在CDN，后端API部署在云服务器，均通过HTTPS对外提供服务。



### 1.3 数据流转

1. **课程配置**：运营人员在后台创建/编辑课程 → 数据写入Supabase的`course`表 → 小程序首页/详情页实时读取。

2. **订单同步**：小程序用户支付成功后，订单数据写入Supabase的`order`表 → 运营后台列表实时展示。

3) **手动退款**：运营后台调用退款接口 → BFF调用Supabase服务端API查询订单 → 调用微信退款 → 更新订单状态。

4) **图片上传**：运营人员上传课程封面、证书等 → 前端直传Supabase Storage（通过临时token或BFF签名） → 返回URL存入数据库。



## 2. 技术栈选型



| 组件   | 选型                         | 说明                     |
| ---- | -------------------------- | ---------------------- |
| 前端   | React 18 + Ant Design 5    | 组件丰富，适合后台快速开发          |
| 前端构建 | Vite 5                     | 快速开发和构建                |
| 后端   | Node.js + Express          | 轻量高效，与小程序后端可共用代码       |
| 数据库  | Supabase (PostgreSQL 15)   | 提供数据库、认证、存储、实时订阅       |
| 认证   | Supabase Auth              | 管理运营后台管理员账号（与小程序用户表分离） |
| 存储   | Supabase Storage           | 存储课程图片、教练证书等           |
| 部署   | Vercel (前端) + 腾讯云/阿里云 (后端) | 前端CDN，后端云服务器           |
| 监控   | Sentry                     | 错误追踪                   |



## 3. 数据库设计



### 3.1 表结构（与小程序共用，增加管理相关字段）

所有表均位于Supabase的`public` schema，通过RLS控制访问。



#### 3.1.1 `users`（小程序用户表，已在PRD中定义）

* 字段：id, openid, unionid, nick\_name, avatar\_url, phone, create\_time...



#### 3.1.2 `admin_users`（后台管理员表，独立于小程序用户）

| 字段名         | 类型           | 约束              | 说明                     |
| ----------- | ------------ | --------------- | ---------------------- |
| id          | uuid         | PRIMARY KEY     | 使用Supabase Auth生成的用户ID |
| email       | varchar(100) | UNIQUE NOT NULL | 登录邮箱                   |
| username    | varchar(50)  | NOT NULL        | 显示名称                   |
| role        | varchar(20)  | NOT NULL        | super\_admin / admin   |
| last\_login | timestamptz  |                 | 最后登录时间                 |
| created\_at | timestamptz  | NOT NULL        | 创建时间                   |



**说明**：使用Supabase Auth管理管理员账号，通过`auth.users`表存储密码，`admin_users`表存储角色等扩展信息。RLS策略：仅允许`service_role`或拥有`super_admin`角色的用户查询/修改。



#### 3.1.3 `course`（课程表，同PRD）

字段不变，但增加`created_by`（管理员ID）和`updated_by`。



#### 3.1.4 `group`（拼团表）

字段不变。



#### 3.1.5 `order`（订单表）

字段不变。



#### 3.1.6 `banner`（Banner表）

字段不变。



#### 3.1.7 `announcement`（公告表）

字段不变。



#### 3.1.8 `admin_log`（操作日志表，新增）

| 字段名         | 类型          | 约束          | 说明                                       |
| ----------- | ----------- | ----------- | ---------------------------------------- |
| id          | bigint      | PRIMARY KEY | 自增                                       |
| admin\_id   | uuid        | NOT NULL    | 关联admin\_users.id                        |
| action      | varchar(50) | NOT NULL    | 操作类型（如'course\_create', 'order\_refund'） |
| target\_id  | bigint      |             | 目标对象ID（如课程ID）                            |
| detail      | jsonb       |             | 操作详情JSON                                 |
| ip          | inet        |             | 操作IP                                     |
| created\_at | timestamptz | NOT NULL    | 操作时间                                     |



### 3.2 RLS策略设计

* **小程序用户**：

  * 对`course`表：SELECT（所有报名未截止课程）

  * 对`group`表：SELECT（通过RLS限制只能看到可加入的拼团），INSERT（仅自己创建的），UPDATE（无权直接修改，通过触发器/函数）

  * 对`order`表：SELECT（仅自己的订单），INSERT（仅自己）

* **运营后台管理员**：所有表由Node.js BFF使用`service_role`密钥操作，绕过RLS（BFF负责权限校验）。



## 4. 后端服务设计



### 4.1 BFF层（Node.js + Express）

#### 4.1.1 目录结构

```plain&#x20;text
backend/
├── src/
│   ├── config/          # 配置（Supabase客户端、微信支付等）
│   ├── middleware/      # 鉴权中间件（验证JWT，检查管理员角色）
│   ├── routes/          # 路由（按模块划分）
│   │   ├── auth.js      # 登录
│   │   ├── courses.js   # 课程管理
│   │   ├── orders.js    # 订单管理
│   │   ├── accounts.js  # 账号管理
│   │   └── upload.js    # 图片上传签名
│   ├── services/        # 业务逻辑（微信退款、Supabase操作）
│   ├── utils/           # 工具函数（日志记录）
│   └── app.js
├── .env                 # 环境变量
└── package.json
```



#### 4.1.2 环境变量

```plain&#x20;text
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 服务端密钥（高权限）
SUPABASE_ANON_KEY=eyJ...           # 匿名密钥（用于前端直传）
WECHAT_APPID=xxx
WECHAT_MCHID=xxx
WECHAT_API_KEY=xxx
WECHAT_CERT_PATH=/path/to/cert.p12
```



#### 4.1.3 核心接口（详见接口文档）

* 管理员登录（使用Supabase Auth + 自定义JWT）

* 课程 CRUD

* 订单列表/详情/退款

* 账号 CRUD（仅超级管理员）

* 图片上传签名（生成Supabase Storage临时上传URL）



#### 4.1.4 权限控制中间件

```javascript
// middleware/auth.js
const { supabaseAdmin } = require('../config/supabase');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ code: 1002, message: '未登录' });
  
  // 验证JWT（由Supabase Auth签发）
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return res.status(401).json({ code: 1002, message: 'token无效' });
  
  // 查询管理员角色
  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!admin) return res.status(403).json({ code: 1003, message: '无权限' });
  
  req.admin = { id: user.id, role: admin.role };
  next();
};
```



#### 4.1.5 操作日志中间件

```javascript
// middleware/logger.js
const { supabaseAdmin } = require('../config/supabase');

module.exports = (action) => async (req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) {
    // 记录操作日志（仅成功时）
    if (data.code === 0 && req.admin) {
      supabaseAdmin.from('admin_log').insert({
        admin_id: req.admin.id,
        action: action,
        target_id: req.params.id || req.body.id,
        detail: { req_body: req.body, ip: req.ip }
      }).then();
    }
    oldJson.call(this, data);
  };
  next();
};
```



### 4.2 Supabase客户端配置

```javascript
// config/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = { supabaseAdmin, supabaseAnon };
```



### 4.3 微信退款集成

```javascript
// services/refund.js
const axios = require('axios');
const crypto = require('crypto');

async function refundOrder(orderNo, amount, reason) {
  // 调用微信退款接口，需双向证书
  // 返回退款结果
}
```



## 5. 前端设计



### 5.1 技术栈

* **框架**：React 18

* **UI库**：Ant Design 5

* **状态管理**：React Query（数据请求）、Zustand（全局状态）

* **HTTP客户端**：axios

* **路由**：React Router 6

* **构建工具**：Vite



### 5.2 页面组件结构

```plain&#x20;text
src/
├── layouts/
│   └── AdminLayout.jsx      # 侧边栏+顶部导航
├── pages/
│   ├── Login.jsx            # 登录页
│   ├── Courses/
│   │   ├── List.jsx         # 课程列表
│   │   ├── Form.jsx         # 课程新增/编辑
│   │   └── components/...
│   ├── Orders/
│   │   ├── List.jsx         # 订单列表
│   │   └── DetailModal.jsx  # 订单详情弹窗
│   ├── Accounts/
│   │   ├── List.jsx         # 账号列表
│   │   └── FormModal.jsx    # 账号新增/编辑弹窗
├── services/                # API调用（axios）
├── hooks/                   # 自定义hooks
├── utils/                   # 工具函数
└── App.jsx
```



### 5.3 关键功能实现

#### 5.3.1 登录

* 调用后端`/admin/login`，获取token并存储到localStorage。

* 在axios请求拦截器中自动添加`Authorization`头。

* 路由守卫：未登录跳转到登录页。



#### 5.3.2 图片上传

* 使用`antd`的Upload组件。

* 上传前调用后端`/upload/sign`获取临时上传URL（Supabase Storage的`createSignedUploadUrl`）。

* 前端直传至Supabase Storage，返回文件路径后保存到表单字段。



#### 5.3.3 富文本编辑器

* 使用`braft-editor`或`wangEditor`，支持图片上传（同样走签名URL）。



#### 5.3.4 数据请求

* 使用React Query管理服务器状态，自动缓存、重试。



## 6. 数据流转与权限安全



### 6.1 小程序与后台数据同步

* **实时性**：小程序通过Supabase客户端实时订阅（可选，MVP可轮询），运营后台通过API获取最新数据（页面刷新即可）。

* **一致性**：所有写操作（课程、订单）均通过Supabase事务保证原子性。



### 6.2 权限安全设计

* **小程序端**：使用Supabase匿名密钥 + RLS限制。用户只能操作自己的订单和拼团。

* **运营后台**：使用Supabase服务端密钥，BFF负责鉴权（基于`admin_users`表角色），所有操作记录日志。

* **网络**：所有通信强制HTTPS，敏感接口（退款）额外验签。



### 6.3 敏感操作防护

* 退款、删除账号等操作需二次确认（前端弹窗+后端校验）。

* 操作日志记录IP、操作人、时间、详情，便于审计。



## 7. 部署与运维



### 7.1 Supabase配置

* 创建项目，启用Auth、Storage。

* 设置RLS策略（可参考附录SQL脚本）。

* 配置Storage bucket（如`course-images`），设置公共读权限（图片可公开访问）。



### 7.2 环境变量

* 开发、测试、生产环境分别配置Supabase项目URL和密钥。

* 微信支付证书需安全存储（建议使用密钥管理服务）。



### 7.3 前端部署

* 使用Vercel或Netlify自动部署Git分支，绑定自定义域名（如`admin.example.com`）。



### 7.4 后端部署

* 部署到云服务器（如腾讯云CVM），使用PM2守护进程。

* Nginx反向代理，配置HTTPS证书。



### 7.5 CI/CD

* GitHub Actions：代码推送后自动构建前端并部署，后端通过SSH上传并重启PM2。



## 8. 附录



### 8.1 接口文档

详见文档：console\_api



### 8.2 RLS策略示例（Supabase SQL）

```sql
-- 课程表：允许所有用户查看未截止课程
CREATE POLICY "Users can view active courses" ON course
  FOR SELECT USING (deadline > now() AND status != 2);

-- 订单表：用户只能查看自己的订单
CREATE POLICY "Users can view own orders" ON "order"
  FOR SELECT USING (auth.uid() = user_id);
```



### 8.3 操作日志表创建SQL

```sql
CREATE TABLE admin_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  action VARCHAR(50) NOT NULL,
  target_id BIGINT,
  detail JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
```



***



**文档结束**
