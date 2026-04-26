# Lindong API Contract

本文档记录当前 `backend/lindong-api` 与后台课包管理实际实现的接口口径。家长端路由统一挂载在 `/api`，运营后台路由统一挂载在 `/api/admin`。

## 小程序课包列表

`GET /api/packages`

Query:

- `page`
- `pageSize`
- `keyword`
- `district`
- `category`
- `latitude`
- `longitude`

响应 `data.list[]`:

```json
{
  "id": "pkg_001",
  "name": "周末体适能5次课包",
  "cover": "https://...",
  "package_category": "体适能",
  "age_range": "4-8岁",
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [{ "target_count": 4, "price_fen": 5000 }],
  "max_supported_people": 8,
  "min_member_amount_fen": 5000,
  "min_member_amount_text": "50.00",
  "location_city": "深圳市",
  "location_district": "南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "active_group_count": 2,
  "distance_meters": 1200,
  "created_at": "2026-04-20T10:00:00.000Z"
}
```

## 小程序课包详情

`GET /api/packages/:id`

响应 `data`:

```json
{
  "id": "pkg_001",
  "name": "周末体适能5次课包",
  "cover": "https://...",
  "images": ["https://..."],
  "total_price_fen": 20000,
  "total_price_text": "200.00",
  "package_category": "体适能",
  "age_range": "4-8岁",
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [{ "target_count": 4, "price_fen": 5000 }],
  "supported_people": [4],
  "location_city": "深圳市",
  "location_district": "南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "coach_name": "教练A",
  "coach_intro": "简介",
  "coach_certificates": ["https://..."],
  "description": "<p>...</p>",
  "insurance_desc": "课程期间统一赠送基础运动意外险，具体保障范围以投保说明为准。",
  "active_groups": []
}
```

## 后台课包列表

`GET /api/admin/packages`

Query:

- `keyword`
- `package_category`
- `status`: `pending` / `active` / `inactive`
- `page`
- `size`

响应 `data.list[]`:

```json
{
  "id": "pkg_001",
  "name": "周末体适能5次课包",
  "cover": "https://...",
  "total_price_fen": 20000,
  "total_price_text": "200.00",
  "package_category": "体适能",
  "age_range": "4-8岁",
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [{ "target_count": 4, "price_fen": 5000 }],
  "supported_people": [4],
  "location_text": "南山区 / 深圳湾社区 / 会所二楼活动室",
  "location_district": "南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "coach_name": "教练A",
  "publish_time": "2026-04-20 10:00:00",
  "unpublish_time": "",
  "status": "active",
  "status_text": "已上架",
  "deadline_hours": 48,
  "create_time": "2026-04-20 10:00:00",
  "update_time": "2026-04-20 10:00:00"
}
```

## 后台课包详情

`GET /api/admin/packages/:id`

在列表字段基础上额外返回：

```json
{
  "images": ["https://..."],
  "longitude": 113.93,
  "latitude": 22.53,
  "coach_intro": "简介",
  "coach_certificates": ["https://..."],
  "description": "<p>...</p>",
  "created_by": "admin-id",
  "updated_by": "admin-id"
}
```

## 后台新增/编辑课包

`POST /api/admin/packages`

`PUT /api/admin/packages/:id`

必填字段：

- `name`
- `package_category`
- `age_range`
- `cover`
- `class_count`
- `class_duration_minutes`
- `group_price_config`
- `location_district`
- `location_community`
- `location_detail`
- `coach_intro`
- `description`
- `publish_time`

请求示例：

```json
{
  "name": "周末体适能5次课包",
  "package_category": "体适能",
  "age_range": "4-8岁",
  "cover": "https://...",
  "images": ["https://..."],
  "class_count": 5,
  "class_duration_minutes": 60,
  "group_price_config": [{ "target_count": 4, "price_fen": 5000 }],
  "supported_people": [4],
  "location_district": "广东省 / 深圳市 / 南山区",
  "location_community": "深圳湾社区",
  "location_detail": "会所二楼活动室",
  "longitude": 113.93,
  "latitude": 22.53,
  "coach_intro": "简介",
  "coach_certificates": ["https://..."],
  "description": "<p>...</p>",
  "deadline_hours": 48,
  "publish_time": "2026-04-20T10:00:00.000Z",
  "unpublish_time": ""
}
```

说明：

- `supported_people` 由服务端根据 `group_price_config.target_count` 重新派生。
- `total_price` 由服务端根据 `group_price_config` 重新派生。
- `status` 由服务端根据上下架时间自动计算，新增/编辑不需要前端提交。
