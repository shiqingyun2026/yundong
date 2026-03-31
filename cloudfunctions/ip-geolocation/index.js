'use strict';

const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const CACHE_COLLECTION_NAME = 'ip_location_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Cache duration: 24 hours
const GEO_PRECISION = 6;

function pickFirstNonEmptyString(candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function resolveClientIp(event, context) {
  return pickFirstNonEmptyString([
    event && event.ip,
    context && context.clientIP,
    context && context.CLIENTIP,
    context && context.clientIp,
    event && event.clientIP,
    event && event.clientIp,
    process.env.WX_CLIENTIP,
    process.env.WX_CLIENTIPV6,
    process.env.TCB_SOURCE_IP,
  ]);
}

function normalizeCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCoordinates(event) {
  const latitude = normalizeCoordinate(event && (event.latitude ?? event.lat));
  const longitude = normalizeCoordinate(event && (event.longitude ?? event.lng ?? event.lon));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function buildCoordinateCacheKey(coordinates) {
  return `geo:${coordinates.latitude.toFixed(GEO_PRECISION)},${coordinates.longitude.toFixed(GEO_PRECISION)}`;
}

// 腾讯地图IP定位API
async function getLocationFromTencentMap(ip, key) {
  const url = `https://apis.map.qq.com/ws/location/v1/ip?ip=${encodeURIComponent(ip)}&key=${key}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP请求失败，状态码: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 0) {
    throw new Error(data.message || '腾讯地图API返回错误');
  }
  
  const { location, ad_info } = data.result;
  
  return {
    latitude: location.lat,
    longitude: location.lng,
    city: ad_info.city,
    province: ad_info.province,
    country: ad_info.nation,
    adcode: ad_info.adcode
  };
}

async function reverseGeocodeFromTencentMap(coordinates, key) {
  const { latitude, longitude } = coordinates;
  const url =
    `https://apis.map.qq.com/ws/geocoder/v1/?location=${encodeURIComponent(`${latitude},${longitude}`)}` +
    `&get_poi=0&key=${key}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP请求失败，状态码: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 0) {
    throw new Error(data.message || '腾讯地图API返回错误');
  }

  const result = data.result || {};
  const location = result.location || {};
  const adInfo = result.ad_info || {};
  const addressComponent = result.address_component || {};
  const formattedAddresses = result.formatted_addresses || {};
  const addressReference = result.address_reference || {};
  const streetNumber = addressComponent.street_number || '';
  const street = addressComponent.street || '';

  return {
    latitude: Number.isFinite(Number(location.lat)) ? Number(location.lat) : latitude,
    longitude: Number.isFinite(Number(location.lng)) ? Number(location.lng) : longitude,
    province: adInfo.province || addressComponent.province || '',
    city: adInfo.city || addressComponent.city || '',
    district: adInfo.district || addressComponent.district || '',
    street,
    street_number: streetNumber,
    address: result.address || '',
    formatted_address: result.address || '',
    adcode: adInfo.adcode || '',
    nation: adInfo.nation || '',
    recommended_address: formattedAddresses.recommend || '',
    rough_address: formattedAddresses.rough || '',
    address_component: addressComponent,
    ad_info: adInfo,
    formatted_addresses: formattedAddresses,
    address_reference: addressReference,
  };
}

exports.main = async (event, context) => {
  const coordinates = resolveCoordinates(event);
  const ip = resolveClientIp(event, context);
  const cacheKey = coordinates ? buildCoordinateCacheKey(coordinates) : ip;

  console.log('event/context ip info', {
    eventLatitude: event && event.latitude,
    eventLongitude: event && event.longitude,
    eventLat: event && event.lat,
    eventLng: event && event.lng,
    eventIp: event && event.ip,
    eventClientIP: event && event.clientIP,
    eventClientIp: event && event.clientIp,
    contextClientIP: context && context.clientIP,
    contextCLIENTIP: context && context.CLIENTIP,
    contextClientIp: context && context.clientIp,
    envWXClientIp: process.env.WX_CLIENTIP,
    envWXClientIpv6: process.env.WX_CLIENTIPV6,
    envTcbSourceIp: process.env.TCB_SOURCE_IP,
    resolvedCoordinates: coordinates,
    resolvedIp: ip,
    cacheKey,
  });

  // 输入验证
  if (!coordinates && !ip) {
    return {
      status: 'error',
      message: '未获取到定位坐标或客户端 IP',
    };
  }

  try {
    // 1. 尝试从缓存获取
    const cacheResult = await db.collection(CACHE_COLLECTION_NAME).doc(cacheKey).get();

    if (cacheResult.data && cacheResult.data.length > 0) {
      const cachedRecord = cacheResult.data[0];
      const isExpired = Date.now() - new Date(cachedRecord.updatedAt).getTime() > CACHE_TTL_MS;

      if (!isExpired) {
        return {
          status: 'success',
          fromCache: true,
          ...cachedRecord,
        };
      }
    }

    // 2. 缓存未命中：从腾讯地图API获取
    const apiKey = process.env.TENCENT_MAP_KEY;
    if (!apiKey) {
      console.error('缺少环境变量 TENCENT_MAP_KEY');
      throw new Error('服务器配置错误：缺少地图API密钥');
    }

    const locationData = coordinates
      ? await reverseGeocodeFromTencentMap(coordinates, apiKey)
      : await getLocationFromTencentMap(ip, apiKey);

    // 3. 更新缓存
    const dataToStore = {
      ...locationData,
      source: coordinates ? 'reverse-geocoder' : 'ip-geolocation',
      updatedAt: new Date(),
    };

    await db.collection(CACHE_COLLECTION_NAME).doc(cacheKey).set(dataToStore);

    // 4. 返回新数据
    return {
      status: 'success',
      fromCache: false,
      source: coordinates ? 'reverse-geocoder' : 'ip-geolocation',
      ...locationData,
    };

  } catch (error) {
    console.error('定位解析错误:', error);
    
    return {
      status: 'error',
      message: error.message || 'IP定位过程中发生未知错误',
    };
  }
};
