# IP定位云函数

使用腾讯地图API和云开发数据库的IP地理位置定位服务。

## 功能特点

- ✅ **免费使用** - 基于云开发免费额度
- ✅ **IP定位** - 通过IP地址获取地理位置
- ✅ **智能缓存** - 24小时缓存机制，减少API调用
- ✅ **完整信息** - 返回经纬度、城市、省份、国家
- ✅ **错误处理** - 完善的错误处理和日志记录

## 使用步骤

### 1. 获取腾讯地图API Key
1. 访问 [腾讯位置服务](https://lbs.qq.com/dev/console/application/mine)
2. 注册账号并创建应用
3. 获取API Key

### 2. 配置环境变量
在云函数配置中添加环境变量：
```
TENCENT_MAP_KEY=你的腾讯地图API密钥
```

### 3. 创建数据库集合
在云开发控制台创建集合：`ip_location_cache`

### 4. 调用示例

#### 小程序端调用
```javascript
wx.cloud.callFunction({
  name: 'ip-geolocation',
  data: {
    ip: '8.8.8.8'
  },
  success: res => {
    if (res.result.status === 'success') {
      console.log('位置信息:', res.result);
    }
  }
})
```

#### Web端调用
```javascript
app.callFunction({
  name: 'ip-geolocation',
  data: { ip: '114.114.114.114' }
}).then(console.log)
```

## 返回数据格式

```json
{
  "status": "success",
  "fromCache": false,
  "latitude": 39.9042,
  "longitude": 116.4074,
  "city": "北京市",
  "province": "北京市",
  "country": "中国",
  "adcode": "110000"
}
```