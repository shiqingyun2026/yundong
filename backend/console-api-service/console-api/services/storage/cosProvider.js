const crypto = require('crypto')

const { getCosStorageConfig } = require('../../../config/storage')
const { createConsoleApiError } = require('../_errors')

const encodePath = objectPath => {
  return `/${`${objectPath || ''}`.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
}

const buildHost = ({ bucket, region }) => `${bucket}.cos.${region}.myqcloud.com`

const getConfig = () => {
  const config = getCosStorageConfig()

  if (!config.bucket || !config.region || !config.secretId || !config.secretKey) {
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 500,
      message: 'COS 存储未配置，无法上传文件'
    })
  }

  return config
}

const sha1 = value => crypto.createHash('sha1').update(value).digest('hex')
const hmacSha1 = (key, value, encoding = 'hex') => crypto.createHmac('sha1', key).update(value).digest(encoding)

const buildPublicUrl = ({ bucket, region, publicBaseUrl, objectPath }) => {
  const encodedPath = encodePath(objectPath)
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}${encodedPath}`
  }

  return `https://${buildHost({ bucket, region })}${encodedPath}`
}

const buildAuthorization = ({ method = 'put', objectPath, contentType = '', now = Math.floor(Date.now() / 1000) }) => {
  const config = getConfig()
  const keyTime = `${now};${now + config.expiresSeconds}`
  const signKey = hmacSha1(config.secretKey, keyTime)
  const encodedPath = encodePath(objectPath)
  const headerList = ['content-type', 'host']
  const urlParamList = []
  const httpString = [
    method.toLowerCase(),
    encodedPath,
    '',
    `content-type=${encodeURIComponent(contentType.toLowerCase())}&host=${encodeURIComponent(buildHost(config))}`,
    ''
  ].join('\n')
  const stringToSign = ['sha1', keyTime, sha1(httpString), ''].join('\n')
  const signature = hmacSha1(signKey, stringToSign)

  return {
    authorization: `q-sign-algorithm=sha1&q-ak=${config.secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList.join(
      ';'
    )}&q-url-param-list=${urlParamList.join(';')}&q-signature=${signature}`,
    expiresAt: now + config.expiresSeconds,
    host: buildHost(config),
    bucket: config.bucket,
    public_url: buildPublicUrl({
      bucket: config.bucket,
      region: config.region,
      publicBaseUrl: config.publicBaseUrl,
      objectPath
    })
  }
}

const uploadObject = async ({ objectPath, contentType, buffer }) => {
  const signed = buildAuthorization({
    method: 'put',
    objectPath,
    contentType
  })

  const response = await fetch(`https://${signed.host}${encodePath(objectPath)}`, {
    method: 'PUT',
    headers: {
      Authorization: signed.authorization,
      Host: signed.host,
      'Content-Type': contentType
    },
    body: buffer
  })

  if (!response.ok) {
    const message = await response.text()
    throw createConsoleApiError({
      responseCode: 5000,
      statusCode: 500,
      message: message || `COS 上传失败（${response.status}）`
    })
  }

  return {
    bucket: signed.bucket,
    path: objectPath,
    public_url: signed.public_url
  }
}

const createSignedUpload = async ({ objectPath, contentType }) => {
  const signed = buildAuthorization({
    method: 'put',
    objectPath,
    contentType
  })

  return {
    bucket: signed.bucket,
    path: objectPath,
    token: signed.authorization,
    signed_url: '',
    upload_url: `https://${signed.host}${encodePath(objectPath)}`,
    public_url: signed.public_url,
    headers: {
      Authorization: signed.authorization,
      Host: signed.host,
      'Content-Type': contentType
    },
    expires_at: new Date(signed.expiresAt * 1000).toISOString()
  }
}

module.exports = {
  createSignedUpload,
  uploadObject
}
