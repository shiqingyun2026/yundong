# 邻动体适能 - 运营后台接口文档



| 文档版本 | 修改日期       | 修改人   | 修改内容             |
| ---- | ---------- | ----- | ---------------- |
| V1.0 | 2026-03-24 | 技术负责人 | 基于运营后台PRD V1.0创建 |



***



## 1. 接口规范



### 1.1 通用说明

* **基础路径**：`https://api.example.com/api/admin`

* **请求方式**：GET/POST/PUT/DELETE

* **数据格式**：JSON

* **认证方式**：JWT token，在请求头 `Authorization: Bearer <token>` 中传递



### 1.2 响应格式

```json
{
  "code": 0,           // 0成功，非0失败
  "message": "ok",     // 错误信息
  "data": {}           // 具体数据
}
```



### 1.3 错误码

| 错误码  | 说明          |
| ---- | ----------- |
| 1001 | 用户名或密码错误    |
| 1002 | token无效或过期  |
| 1003 | 无权限操作       |
| 2001 | 课程不存在       |
| 2002 | 订单不存在       |
| 2003 | 订单状态异常，无法退款 |
| 3001 | 微信退款接口调用失败  |
| 4001 | 账号已存在       |
| 4002 | 超级管理员账号不可删除 |
| 5000 | 系统内部错误      |



***



## 2. 登录认证



### 2.1 管理员登录

* **URL**：`/login`

* **Method**：POST

* **请求参数**：

```json
{
  "username": "admin",
  "password": "123456"
}
```

* **响应**：

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "super_admin"   // super_admin / admin
    }
  }
}
```

* **说明**：登录成功后返回token，后续请求携带此token。



***



## 3. 账号管理



### 3.1 获取账号列表

* **URL**：`/accounts`

* **Method**：GET

* **请求参数**（Query）：

  * `keyword`：string，用户名搜索关键字（可选）

  * `page`：int，页码，默认1

  * `size`：int，每页条数，默认10

* **响应**：

```json
{
  "code": 0,
  "data": {
    "total": 10,
    "list": [
      {
        "id": 1,
        "username": "admin",
        "role": "super_admin",
        "last_login_time": "2026-03-24 10:00:00",
        "create_time": "2026-03-01 09:00:00"
      },
      {
        "id": 2,
        "username": "operator1",
        "role": "admin",
        "last_login_time": "2026-03-23 14:30:00",
        "create_time": "2026-03-10 11:00:00"
      }
    ]
  }
}
```



### 3.2 新增账号

* **URL**：`/account`

* **Method**：POST

* **请求参数**：

```json
{
  "username": "operator2",
  "password": "123456",
  "role": "admin"   // super_admin / admin
}
```

* **响应**：标准返回

* **说明**：仅超级管理员可操作。密码需加密存储。



### 3.3 编辑账号

* **URL**：`/account/{id}`

* **Method**：PUT

* **请求参数**：

```json
{
  "password": "newpassword",   // 可选，不传则不修改密码
  "role": "admin"
}
```

* **响应**：标准返回



### 3.4 删除账号

* **URL**：`/account/{id}`

* **Method**：DELETE

* **响应**：标准返回

* **说明**：超级管理员账号不可删除。



***



## 4. 课程管理



### 4.1 获取课程列表

* **URL**：`/courses`

* **Method**：GET

* **请求参数**（Query）：

  * `keyword`：string，课程名称关键字（可选）

  * `start_date`：string，开始日期（可选，格式YYYY-MM-DD）

  * `end_date`：string，结束日期（可选）

  * `page`：int，默认1

  * `size`：int，默认10

* **响应**：

```json
{
  "code": 0,
  "data": {
    "total": 50,
    "list": [
      {
        "id": 1,
        "title": "儿童体能基础班",
        "start_time": "2026-03-25 10:00:00",
        "end_time": "2026-03-25 11:00:00",
        "location_community": "阳光花园",
        "location_detail": "中心广场",
        "group_price": 8000,
        "original_price": 12000,
        "target_count": 4,
        "status": 0   // 0-待开始,1-进行中,2-已结束
      }
    ]
  }
}
```



### 4.2 获取课程详情

* **URL**：`/course/{id}`

* **Method**：GET

* **响应**：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "title": "儿童体能基础班",
    "cover": "https://xxx.com/cover.jpg",
    "images": ["url1", "url2"],
    "description": "<p>课程介绍...</p>",
    "age_range": "3-6岁",
    "original_price": 12000,
    "group_price": 8000,
    "target_count": 4,
    "start_time": "2026-03-25 10:00:00",
    "end_time": "2026-03-25 11:00:00",
    "location_district": "南山区",
    "location_community": "阳光花园",
    "location_detail": "中心广场",
    "longitude": 113.928574,
    "latitude": 22.543096,
    "deadline": "2026-03-24 10:00:00",
    "coach_name": "李教练",
    "coach_intro": "国家二级运动员，5年儿童体能教学经验",
    "coach_cert": ["cert1.jpg", "cert2.jpg"],
    "status": 0
  }
}
```



### 4.3 新增课程

* **URL**：`/course`

* **Method**：POST

* **请求参数**：同课程详情字段（除id、status外），所有字段必填

* **响应**：返回课程id



### 4.4 编辑课程

* **URL**：`/course/{id}`

* **Method**：PUT

* **请求参数**：同新增课程，支持部分字段更新

* **响应**：标准返回



### 4.5 下架课程

* **URL**：`/course/{id}/offline`

* **Method**：PUT

* **响应**：标准返回

* **说明**：将课程状态更新为2（已结束），前端不再显示。



***



## 5. 订单管理



### 5.1 获取订单列表

* **URL**：`/orders`

* **Method**：GET

* **请求参数**（Query）：

  * `order_no`：string，订单号（可选）

  * `nick_name`：string，用户昵称（可选）

  * `phone`：string，用户手机号（可选）

  * `course_title`：string，课程名称（可选）

  * `status`：int，订单状态（1-已支付,2-已退款，可选）

  * `page`：int，默认1

  * `size`：int，默认10

* **响应**：

```json
{
  "code": 0,
  "data": {
    "total": 100,
    "list": [
      {
        "id": 10001,
        "order_no": "20260324123456",
        "user_nick_name": "妈妈1",
        "user_phone": "13812345678",
        "course_title": "儿童体能基础班",
        "amount": 8000,
        "status": 1,           // 1-已支付,2-已退款
        "create_time": "2026-03-24 10:00:00",
        "pay_time": "2026-03-24 10:05:00"
      }
    ]
  }
}
```



### 5.2 获取订单详情

* **URL**：`/order/{id}`

* **Method**：GET

* **响应**：

```json
{
  "code": 0,
  "data": {
    "id": 10001,
    "order_no": "20260324123456",
    "user": {
      "id": 1001,
      "nick_name": "妈妈1",
      "phone": "13812345678",
      "avatar_url": "https://xxx.com/avatar.jpg"
    },
    "course": {
      "id": 1,
      "title": "儿童体能基础班",
      "start_time": "2026-03-25 10:00:00",
      "end_time": "2026-03-25 11:00:00",
      "location_community": "阳光花园",
      "location_detail": "中心广场"
    },
    "group": {
      "id": 101,
      "current_count": 4,
      "target_count": 4,
      "status": 1
    },
    "amount": 8000,
    "status": 1,
    "pay_time": "2026-03-24 10:05:00",
    "refund_time": null,
    "refund_reason": null,
    "create_time": "2026-03-24 10:00:00"
  }
}
```



### 5.3 手动退款

* **URL**：`/order/{id}/refund`

* **Method**：POST

* **请求参数**：

```json
{
  "reason": "用户申请退款"
}
```

* **响应**：标准返回

* **说明**：

  * 仅订单状态为1（已支付）时可操作。

  * 调用微信退款接口，成功后更新订单状态为2（已退款），记录退款时间和原因。



***



## 6. 数据字段映射总表



### 6.1 账号管理页面字段映射



| 前端字段   | 数据库表/字段            | 说明                   |
| ------ | ------------------ | -------------------- |
| ID     | admin.id           |                      |
| 用户名    | admin.username     |                      |
| 角色     | admin.role         | super\_admin / admin |
| 最后登录时间 | admin.last\_login  |                      |
| 创建时间   | admin.create\_time |                      |



### 6.2 课程管理页面字段映射



| 前端字段   | 数据库表/字段                                       | 说明             |
| ------ | --------------------------------------------- | -------------- |
| 课程ID   | course.id                                     |                |
| 课程名称   | course.title                                  |                |
| 上课时间   | course.start\_time \~ end\_time               | 格式化显示          |
| 上课地点   | course.location\_community + location\_detail |                |
| 拼团价    | course.group\_price                           | 单位分，前端转元       |
| 原价     | course.original\_price                        | 单位分            |
| 成团人数   | course.target\_count                          |                |
| 状态     | course.status                                 | 0待开始/1进行中/2已结束 |
| 封面图    | course.cover                                  | 上传存储URL        |
| 轮播图    | course.images                                 | JSON数组         |
| 课程介绍   | course.description                            | 富文本            |
| 适用年龄   | course.age\_range                             |                |
| 区域     | course.location\_district                     |                |
| 小区名称   | course.location\_community                    |                |
| 详细地点   | course.location\_detail                       |                |
| 经纬度    | course.longitude, latitude                    | 用于距离计算         |
| 报名截止时间 | course.deadline                               |                |
| 教练姓名   | course.coach\_name                            |                |
| 教练简介   | course.coach\_intro                           |                |
| 教练证书   | course.coach\_cert                            | JSON数组         |



### 6.3 订单管理页面字段映射



| 前端字段  | 数据库表/字段               | 说明                   |
| ----- | --------------------- | -------------------- |
| 订单号   | order.order\_no       |                      |
| 用户昵称  | user.nick\_name       | 通过order.user\_id关联   |
| 用户手机号 | user.phone            | 通过order.user\_id关联   |
| 课程名称  | course.title          | 通过order.course\_id关联 |
| 支付金额  | order.amount          | 单位分，前端转元             |
| 状态    | order.status          | 1已支付/2已退款            |
| 下单时间  | order.create\_time    |                      |
| 支付时间  | order.pay\_time       |                      |
| 退款时间  | order.refund\_time    |                      |
| 退款原因  | order.refund\_reason  |                      |
| 拼团ID  | order.group\_id       | 关联group表             |
| 微信交易号 | order.transaction\_id |                      |
| 商户订单号 | order.out\_trade\_no  |                      |



***



## 7. 接口调用流程示例



### 7.1 登录 → 获取课程列表

```plain&#x20;text
POST /admin/login
→ 返回token

GET /admin/courses?page=1&size=10
Header: Authorization: Bearer {token}
→ 返回课程列表
```



### 7.2 手动退款

```plain&#x20;text
GET /admin/orders?status=1
→ 获取已支付订单列表

POST /admin/order/10001/refund
Header: Authorization: Bearer {token}
Body: {"reason": "用户申请退款"}
→ 调用微信退款，更新订单状态
```



***



**文档结束**
