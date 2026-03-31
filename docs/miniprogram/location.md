## 位置系统最终开发 Spec

### 1. 功能目标

实现一个完整的小程序位置系统，支持：

- 自动定位并展示附近课程
- 用户手动搜索并切换到其他位置查看课程
- 首页课程列表始终基于“当前业务使用位置”加载
- 支持后续扩展到更多城市

### 2. 核心设计

#### 2.1 双 Location 模型

```js
gpsLocation      // 设备真实定位，被动更新
selectedLocation // 当前业务使用位置，驱动页面展示与课程请求
```

#### 2.2 统一数据结构

```js
location = {
  latitude: Number,
  longitude: Number,
  name: String,
  address: String,
  city: String,
  district: String,
  source: 'gps' | 'manual' | 'default'
}
```

约束：

- 只允许使用 `latitude` / `longitude`
- 不再新增 `lat` / `lng` / `displayName` 之类的平行字段

### 3. 全局状态与缓存

#### 3.1 全局状态

```js
app.globalData = {
  gpsLocation: null,
  selectedLocation: null
}
```

#### 3.2 本地缓存

```js
wx.setStorageSync('gpsLocation', gpsLocation)
wx.setStorageSync('selectedLocation', selectedLocation)
```

### 4. 首页规则

#### 4.1 初始化优先级

```js
selectedLocation > gpsLocation > DEFAULT_LOCATION
```

默认位置固定为深圳龙岗区：

```js
{
  latitude: 22.7215,
  longitude: 114.2510,
  name: '龙岗区',
  address: '深圳市龙岗区',
  city: '深圳',
  district: '龙岗区',
  source: 'default'
}
```

#### 4.2 页面展示逻辑

- 顶部位置栏展示 `selectedLocation.name`
- 如果 `selectedLocation.source === 'manual'`，显示“已切换”
- 课程列表请求只使用 `selectedLocation.latitude` / `selectedLocation.longitude`

#### 4.3 生命周期

- `onLoad`：初始化位置并拉课程
- `onShow`：检测 `selectedLocation` 是否变化，变化则刷新课程

### 5. GPS 定位规则

#### 5.1 获取流程

1. `wx.getLocation`
2. 调用云函数进行逆地理编码
3. 生成标准化 `gpsLocation`
4. 写入 `gpsLocation`

#### 5.2 关键约束

- GPS 更新时不能覆盖 `selectedLocation`
- 只有首次进入且没有 `selectedLocation` 时，才允许自动把 `selectedLocation` 设为 `gpsLocation`

### 6. 搜索页

页面路径：

```text
pages/location-search/index
```

#### 6.1 页面职责

- 接收 `city` 参数
- 展示当前定位卡片
- 搜索地址 / 小区 / 商圈
- 选择某个结果后切换 `selectedLocation`

#### 6.2 页面状态

```js
{
  keyword: '',
  city: '深圳',
  loading: false,
  searchState: 'idle' | 'loading' | 'empty' | 'result',
  resultList: [],
  gpsLocation: null,
  currentLocation: null
}
```

#### 6.3 搜索逻辑

- 搜索城市优先用 `selectedLocation.city`
- 没有时回退深圳
- 关键词为空时显示默认页
- 输入后 300ms 防抖
- 通过云函数调用腾讯地图 POI 搜索

#### 6.4 选择行为

搜索结果标准化后写入：

```js
selectedLocation = {
  latitude,
  longitude,
  name,
  address,
  city,
  district,
  source: 'manual'
}
```

然后返回首页，首页 `onShow` 负责刷新课程。

#### 6.5 当前定位卡片

- 卡片主体点击：直接切换到 `gpsLocation`
- “重定位”按钮：重新发起 GPS 定位，并更新 `gpsLocation`
- 如果定位成功，则同步切换 `selectedLocation = gpsLocation`

### 7. 云函数约束

继续使用现有 `ip-geolocation` 云函数，但扩展两类能力：

#### 7.1 经纬度逆地理编码

输入：

```js
{
  latitude,
  longitude
}
```

输出：

- `province`
- `city`
- `district`
- `street`
- `address`

#### 7.2 POI 搜索

输入：

```js
{
  action: 'search',
  keyword: '科技园',
  city: '深圳'
}
```

输出：

```js
{
  status: 'success',
  source: 'poi-search',
  list: [...]
}
```

### 8. UI 参考实现

位置搜索页需要参考 Visily 设计稿，至少实现 4 种状态：

- 默认页：搜索框 + 当前定位卡片
- 搜索中：中部 loading 图标与说明文案
- 搜索结果：列表卡片 + 距离 + 空间分隔
- 搜不到：中部空状态图文

视觉方向：

- 页面背景浅灰白
- 搜索框圆角、浅灰底
- 当前定位卡片用轻蓝底强调
- 结果卡片白底圆角，右侧显示距离标签与箭头

### 9. 技术实现约束

- 首页课程列表只依赖 `selectedLocation`
- 不允许页面直接用 GPS 坐标驱动列表
- 不允许把城市写死进搜索逻辑
- 不允许引入与统一结构冲突的 location 字段

### 10. 验收标准

#### 10.1 首页

- 首次进入自动定位成功时，可加载附近课程
- 手动选址后，首页位置栏显示新位置并刷新课程
- 再次进入首页时，仍保留上次手动选择的位置

#### 10.2 搜索页

- 空关键词显示默认态
- 输入关键词后出现 loading
- 搜索成功显示结果列表
- 无结果显示空状态
- 点击结果后返回首页并刷新课程

#### 10.3 定位

- 定位失败时仍可通过手动搜索切换位置
- 点击“重定位”后能重新获取当前位置
