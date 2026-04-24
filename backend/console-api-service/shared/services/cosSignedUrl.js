const crypto = require('crypto')

const { getCosStorageConfig, getStorageProviderName } = require('../../config/storage')

const sha1 = value => crypto.createHash('sha1').update(value).digest('hex')
const hmacSha1 = (key, value, encoding = 'hex') => crypto.createHmac('sha1', key).update(value).digest(encoding)

const encodePath = objectPath => {
  return `/${`${objectPath || ''}`.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
}

const isCosStorageReady = config => {
  return !!(config && config.secretId && config.secretKey)
}

const buildGetAuthQuery = ({ objectPath, host, now = Math.floor(Date.now() / 1000) }) => {
  const config = getCosStorageConfig()
  if (!isCosStorageReady(config)) {
    return ''
  }

  const keyTime = `${now};${now + config.expiresSeconds}`
  const signKey = hmacSha1(config.secretKey, keyTime)
  const encodedPath = encodePath(objectPath)
  const httpString = ['get', encodedPath, '', `host=${encodeURIComponent(host)}`, ''].join('\n')
  const stringToSign = ['sha1', keyTime, sha1(httpString), ''].join('\n')
  const signature = hmacSha1(signKey, stringToSign)

  return [
    'q-sign-algorithm=sha1',
    `q-ak=${encodeURIComponent(config.secretId)}`,
    `q-sign-time=${encodeURIComponent(keyTime)}`,
    `q-key-time=${encodeURIComponent(keyTime)}`,
    'q-header-list=host',
    'q-url-param-list=',
    `q-signature=${signature}`
  ].join('&')
}

const signCosPublicUrl = rawUrl => {
  if (!rawUrl || getStorageProviderName() !== 'cos') {
    return rawUrl || ''
  }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (error) {
    return rawUrl
  }

  const config = getCosStorageConfig()
  if (!isCosStorageReady(config)) {
    return rawUrl
  }

  if (!/\.cos\.[^.]+\.myqcloud\.com$/i.test(parsed.host)) {
    return rawUrl
  }

  const objectPath = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '')
  if (!objectPath) {
    return rawUrl
  }

  const query = buildGetAuthQuery({
    objectPath,
    host: parsed.host
  })
  if (!query) {
    return rawUrl
  }

  parsed.search = parsed.search ? `${parsed.search.slice(1)}&${query}` : query
  return parsed.toString()
}

const signCosImageList = list => {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(item => signCosPublicUrl(item)).filter(Boolean)
}

const signCosUrlsInText = value => {
  const text = `${value || ''}`
  if (!text) {
    return ''
  }

  return text.replace(/https?:\/\/[^\s"'<>]+/gi, matched => signCosPublicUrl(matched))
}

module.exports = {
  signCosImageList,
  signCosPublicUrl,
  signCosUrlsInText
}
