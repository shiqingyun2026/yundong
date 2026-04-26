# 2026-04-19 课包拼团 V2.2 API 接口文档

## 1. 文档目标

本文档定义课包拼团 V2.2 第一阶段接口口径。

适用范围：

- 小程序家长端课包主链路
- 后台课包管理主链路
- 继续复用当前 JWT / `callContainer` / HTTP 访问方式

## 2. 通用规范

## 2.1 小程序基础路径

- `wx.cloud.callContainer`
- 服务名：`lindong-api`
- 路径前缀：`/api`

## 2.2 后台基础路径

- `http(s)://{console-api-host}/api/admin`

## 2.3 响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## 2.4 通用错误码

| code | 说明 |
|------|------|
| 1001 | 参数错误 |
| 1002 | token 无效或过期 |
| 1003 | 无权限操作 |
| 2001 | 课包不存在 |
| 2002 | 拼团不存在 |
| 2003 | 订单不存在 |
| 2004 | 预留：重复参与限制已取消，当前不应由同用户同课包或同团重复报名触发 |
| 2005 | 拼团已满员或已截止 |
| 2006 | 订单状态异常 |
| 5000 | 系统内部错误 |

## 3. 小程序接口

## 3.1 课包列表

- `GET /packages`

Query：

- `page`
- `pageSize`
- `keyword` 可选
- `district` 可选

响应：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "pkg_001",
        "name": "周末体适能5次课包",
        "cover": "https://...",
        "age_range": "4-8岁",
        "max_supported_people": 8,
        "min_member_amount_fen": 16666,
        "min_member_amount_text": "166.66",
        "location_district": "南山区",
        "location_community": "深圳湾社区",
        "location_detail": "会所二楼活动室",
        "active_group_count": 2
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

说明：

- 首页卡片只展示按“最大人数”计算的人均价
- 不展示总价

## 3.2 课包详情

- `GET /packages/:id`

响应：

```json
{
  "code": 0,
  "data": {
    "id": "pkg_001",
    "name": "周末体适能5次课包",
    "cover": "https://...",
    "images": ["https://..."],
    "total_price_fen": 133333,
    "total_price_text": "1333.33",
    "age_range": "4-8岁",
    "supported_people": [2, 4, 6, 8],
    "location_district": "南山区",
    "location_community": "深圳湾社区",
    "location_detail": "会所二楼活动室",
    "coach_name": "教练A",
    "coach_intro": "简介",
    "coach_certificates": ["https://..."],
    "description": "<p>...</p>",
    "insurance_desc": "固定文案",
    "active_groups": [
      {
        "id": "pg_001",
        "target_count": 4,
        "current_count": 2,
        "status": "active",
        "remaining_seconds": 90000,
        "member_amount_fen": 33333,
        "member_amount_text": "333.33",
        "schedule_text": "每周六 10:00，共5次"
      }
    ]
  }
}
```

说明：

- `active_groups` 不返回团长昵称
- 进行中团只返回抽象时段文案，不返回具体首课日期

## 3.3 发起开团订单

- `POST /package-orders/start`

请求：

```json
{
  "packageId": "pkg_001",
  "targetCount": 4,
  "weekday": 6,
  "hour": 10
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "orderId": "ord_001",
    "orderNo": "LD2026...",
    "orderType": 2,
    "action": "start",
    "packageId": "pkg_001",
    "targetCount": 4,
    "weekday": 6,
    "hour": 10,
    "member_amount_fen": 33333,
    "member_amount_text": "333.33",
    "status": "pending"
  }
}
```

校验：

- 当前用户不能已参与该课包的 `active/success` 团
- 只创建待支付订单，不提前创建正式团

## 3.4 发起参团订单

- `POST /package-orders/join`

请求：

```json
{
  "packageId": "pkg_001",
  "packageGroupId": "pg_001"
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "orderId": "ord_002",
    "orderNo": "LD2026...",
    "orderType": 2,
    "action": "join",
    "packageId": "pkg_001",
    "packageGroupId": "pg_001",
    "member_amount_fen": 33333,
    "member_amount_text": "333.33",
    "status": "pending"
  }
}
```

校验：

- 当前用户不能已参与该课包的 `active/success` 团
- 团必须仍处于 `active`
- 团不能已满员
- 团不能已截止

## 3.5 拼团详情

- `GET /package-groups/:id`

响应：

```json
{
  "code": 0,
  "data": {
    "id": "pg_001",
    "status": "active",
    "package": {
      "id": "pkg_001",
      "name": "周末体适能5次课包",
      "location_text": "深圳湾社区 会所二楼活动室",
      "coach_name": "教练A"
    },
    "target_count": 4,
    "current_count": 2,
    "remaining_seconds": 90000,
    "member_amount_fen": 33333,
    "member_amount_text": "333.33",
    "schedule_mode": "pending",
    "schedule_text": "每周六 10:00，共5次，成团后锁定首课日期",
    "first_class_time": null,
    "schedule_list": [],
    "members": [
      {
        "user_id": "u_001",
        "nickname": "小明妈妈",
        "avatar_url": "https://..."
      }
    ],
    "user_joined": true
  }
}
```

已成团时：

- `schedule_mode = "locked"`
- `first_class_time` 返回具体时间
- `schedule_list` 返回 5 次具体时间

## 3.6 我的课包拼团列表

- `GET /user/package-groups`

Query：

- `status`：
  - `all`
  - `active`
  - `success`
  - `failed`
- `page`
- `pageSize`

响应：

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "package_group_id": "pg_001",
        "package_id": "pkg_001",
        "package_name": "周末体适能5次课包",
        "status": "active",
        "location_text": "深圳湾社区 会所二楼活动室",
        "first_class_time": null,
        "display_time_text": "每周六 10:00，共5次",
        "member_amount_text": "333.33"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

## 3.7 模拟支付成功

- `POST /payments/mock-success`

请求：

```json
{
  "orderId": "ord_001"
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "orderId": "ord_001",
    "status": "success",
    "packageGroupId": "pg_001",
    "groupStatus": "active"
  }
}
```

行为：

- 若订单是 `package_action=start`
  - 支付成功后创建正式团
- 若订单是 `package_action=join`
  - 支付成功后加入已有团
- 若支付后达到目标人数
  - 自动更新团为 `success`
  - 锁定 `first_class_time`

## 4. 后台接口

## 4.1 课包列表

- `GET /packages`

Query：

- `keyword`
- `status`
- `page`
- `size`

响应：

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "page": 1,
    "size": 10,
    "list": [
      {
        "id": "pkg_001",
        "name": "周末体适能5次课包",
        "total_price_fen": 133333,
        "age_range": "4-8岁",
        "supported_people": [2, 4, 6, 8],
        "location_text": "南山区 / 深圳湾社区 / 会所二楼活动室",
        "coach_name": "教练A",
        "status": "active",
        "create_time": "2026-04-20 10:00:00"
      }
    ]
  }
}
```

## 4.2 新增课包

- `POST /packages`

请求：

```json
{
  "name": "周末体适能5次课包",
  "age_range": "4-8岁",
  "cover": "https://...",
  "images": ["https://..."],
  "total_price_fen": 133333,
  "supported_people": [2, 4, 6, 8],
  "location_district": "南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "longitude": 113.93,
  "latitude": 22.53,
  "coach_name": "教练A",
  "coach_intro": "简介",
  "coach_certificates": ["https://..."],
  "description": "<p>...</p>",
  "status": "active"
}
```

说明：

- `deadline_hours` 第一版固定为 48，前端不传

## 4.3 编辑课包

- `PUT /packages/:id`

请求结构同新增。

## 4.4 课包拼团列表

- `GET /package-groups`

Query：

- `package_id`
- `status`
- `page`
- `size`

响应：

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "page": 1,
    "size": 10,
    "list": [
      {
        "id": "pg_001",
        "package_id": "pkg_001",
        "package_name": "周末体适能5次课包",
        "status": "active",
        "target_count": 4,
        "current_count": 2,
        "deadline": "2026-04-22 10:00:00",
        "schedule_text": "每周六 10:00，共5次",
        "first_class_time": null,
        "create_time": "2026-04-20 10:00:00"
      }
    ]
  }
}
```

## 4.5 课包订单列表

- `GET /package-orders`

Query：

- `keyword`
- `status`
- `package_id`
- `page`
- `size`

响应：

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "page": 1,
    "size": 10,
    "list": [
      {
        "id": "ord_001",
        "order_no": "LD2026...",
        "nickname": "小明妈妈",
        "phone": "",
        "package_name": "周末体适能5次课包",
        "package_group_id": "pg_001",
        "amount_fen": 33333,
        "amount_text": "333.33",
        "status": "success",
        "order_type": 2,
        "action": "start",
        "create_time": "2026-04-20 10:00:00",
        "pay_time": "2026-04-20 10:01:00"
      }
    ]
  }
}
```

## 4.6 手动退款

- `POST /package-orders/:id/refund`

请求：

```json
{
  "reason": "用户线下申请退款"
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "id": "ord_001",
    "status": "refunded",
    "refund_time": "2026-04-20 11:00:00"
  }
}
```

限制：

- 第一阶段只允许对 `success` 订单发起后台退款
- 若团已成团，不支持个人线上退款；后台需按业务规则限制操作

## 5. 兼容与保留接口说明

第一阶段：

- 旧单次课程接口继续保留
- 旧接口不再作为新功能入口继续扩展
- 后续前台和后台只接入课包接口
