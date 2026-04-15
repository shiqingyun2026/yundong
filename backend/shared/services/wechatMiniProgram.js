const crypto = require('node:crypto')

const WECHAT_API_BASE = 'https://api.weixin.qq.com'
const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'
const WECHAT_PAY_V3_API_BASE = 'https://api.mch.weixin.qq.com'

const ACCESS_TOKEN_BUFFER_MS = 60 * 1000

let wechatAccessTokenCache = {
  token: '',
  expiresAt: 0
}

const readRequiredEnv = key => {
  const value = `${process.env[key] || ''}`.trim()
  if (!value) {
    throw new Error(`${key} is required`)
  }

  return value
}

const readOptionalEnv = key => `${process.env[key] || ''}`.trim()

const safeJsonParse = text => {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options)
  const rawText = await response.text()
  const payload = safeJsonParse(rawText)

  if (!response.ok) {
    const error = new Error(
      (payload && (payload.message || payload.errmsg)) || `wechat request failed: ${response.status}`
    )
    error.statusCode = response.status
    error.payload = payload
    error.rawText = rawText
    throw error
  }

  return payload
}

const getMiniProgramAppId = () => readRequiredEnv('WX_MINIPROGRAM_APP_ID')

const getMiniProgramAppSecret = () => readRequiredEnv('WX_MINIPROGRAM_APP_SECRET')

const getWechatPayMerchantId = () => readRequiredEnv('WX_PAY_MCH_ID')

const getWechatPayMerchantSerialNo = () => readRequiredEnv('WX_PAY_MCH_SERIAL_NO')

const getWechatPayApiV3Key = () => readRequiredEnv('WX_PAY_API_V3_KEY')

const getWechatPayNotifyUrl = () => readRequiredEnv('WX_PAY_NOTIFY_URL')

const getWechatPayPlatformCertificate = () => {
  const direct = readOptionalEnv('WX_PAY_PLATFORM_CERT')
  const normalized = direct.replace(/\\n/g, '\n').trim()

  if (!normalized) {
    throw new Error('WX_PAY_PLATFORM_CERT is required')
  }

  return normalized
}

const getWechatPayPrivateKey = () => {
  const direct = readOptionalEnv('WX_PAY_PRIVATE_KEY')
  const normalized = direct.replace(/\\n/g, '\n').trim()

  if (normalized) {
    return normalized
  }

  return readRequiredEnv('WX_PAY_PRIVATE_KEY')
}

const getWechatAccessToken = async () => {
  const now = Date.now()
  if (wechatAccessTokenCache.token && wechatAccessTokenCache.expiresAt - ACCESS_TOKEN_BUFFER_MS > now) {
    return wechatAccessTokenCache.token
  }

  const appId = getMiniProgramAppId()
  const appSecret = getMiniProgramAppSecret()
  const url = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`
  const payload = await fetchJson(url, { method: 'GET' })

  if (!payload || payload.errcode) {
    throw new Error((payload && payload.errmsg) || 'failed to fetch wechat access token')
  }

  wechatAccessTokenCache = {
    token: payload.access_token || '',
    expiresAt: now + (Number(payload.expires_in) || 0) * 1000
  }

  if (!wechatAccessTokenCache.token) {
    throw new Error('wechat access token missing')
  }

  return wechatAccessTokenCache.token
}

const exchangeCodeForSession = async code => {
  const appId = getMiniProgramAppId()
  const appSecret = getMiniProgramAppSecret()
  const url = `${WECHAT_API_BASE}/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const payload = await fetchJson(url, {
    method: 'GET'
  })

  if (!payload || payload.errcode) {
    const error = new Error((payload && payload.errmsg) || 'failed to exchange code for session')
    error.payload = payload
    throw error
  }

  if (!payload.openid) {
    throw new Error('wechat openid missing in code2Session response')
  }

  return {
    openId: payload.openid || '',
    unionId: payload.unionid || '',
    sessionKey: payload.session_key || ''
  }
}

const randomNonce = (size = 32) => crypto.randomBytes(size).toString('hex').slice(0, size)

const signWithMerchantPrivateKey = message => {
  const privateKey = getWechatPayPrivateKey()
  return crypto.createSign('RSA-SHA256').update(message).end().sign(privateKey, 'base64')
}

const buildWechatPayAuthorizationHeader = ({ method, pathname, body = '' }) => {
  const mchId = getWechatPayMerchantId()
  const serialNo = getWechatPayMerchantSerialNo()
  const nonce = randomNonce(32)
  const timestamp = `${Math.floor(Date.now() / 1000)}`
  const message = `${method}\n${pathname}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = signWithMerchantPrivateKey(message)

  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`
}

const requestWechatPayV3 = async ({ method, pathname, body }) => {
  const serializedBody = body ? JSON.stringify(body) : ''
  const authorization = buildWechatPayAuthorizationHeader({
    method,
    pathname,
    body: serializedBody
  })
  const response = await fetch(`${WECHAT_PAY_V3_API_BASE}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authorization
    },
    body: serializedBody || undefined
  })
  const rawText = await response.text()
  const payload = safeJsonParse(rawText)

  if (!response.ok) {
    const error = new Error(
      (payload && (payload.message || payload.code)) || `wechat pay request failed: ${response.status}`
    )
    error.statusCode = response.status
    error.payload = payload
    error.rawText = rawText
    throw error
  }

  return payload
}

const createMiniProgramPayment = async ({ openId, description, outTradeNo, amountFen, attach = '' }) => {
  const appId = getMiniProgramAppId()
  const mchId = getWechatPayMerchantId()
  const notifyUrl = getWechatPayNotifyUrl()
  const payload = {
    appid: appId,
    mchid: mchId,
    description: `${description || '邻动体适能课程报名'}`.slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: Math.max(1, Number(amountFen) || 0),
      currency: 'CNY'
    },
    payer: {
      openid: openId
    }
  }

  if (attach) {
    payload.attach = attach
  }

  return requestWechatPayV3({
    method: 'POST',
    pathname: '/v3/pay/transactions/jsapi',
    body: payload
  })
}

const buildMiniProgramPaymentParams = prepayId => {
  const appId = getMiniProgramAppId()
  const nonceStr = randomNonce(32)
  const timeStamp = `${Math.floor(Date.now() / 1000)}`
  const packageValue = `prepay_id=${prepayId}`
  const signType = 'RSA'
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`
  const paySign = signWithMerchantPrivateKey(message)

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType,
    paySign
  }
}

const decryptWechatPayResource = resource => {
  if (!resource || typeof resource !== 'object') {
    throw new Error('wechat pay callback resource is required')
  }

  const associatedData = `${resource.associated_data || ''}`
  const nonce = `${resource.nonce || ''}`
  const ciphertext = `${resource.ciphertext || ''}`

  if (!nonce || !ciphertext) {
    throw new Error('wechat pay callback resource is incomplete')
  }

  const key = Buffer.from(getWechatPayApiV3Key(), 'utf8')
  const decoded = Buffer.from(ciphertext, 'base64')
  const authTag = decoded.subarray(decoded.length - 16)
  const data = decoded.subarray(0, decoded.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'))

  if (associatedData) {
    decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  }

  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  const payload = safeJsonParse(plaintext)

  if (!payload) {
    throw new Error('failed to parse wechat pay callback resource')
  }

  return payload
}

const verifyWechatPayCallbackSignature = ({
  timestamp,
  nonce,
  signature,
  rawBody
}) => {
  const certificate = getWechatPayPlatformCertificate()
  const message = `${timestamp || ''}\n${nonce || ''}\n${rawBody || ''}\n`

  return crypto
    .createVerify('RSA-SHA256')
    .update(message)
    .end()
    .verify(certificate, signature || '', 'base64')
}

module.exports = {
  getMiniProgramAppId,
  getMiniProgramAppSecret,
  getWechatAccessToken,
  exchangeCodeForSession,
  createMiniProgramPayment,
  buildMiniProgramPaymentParams,
  decryptWechatPayResource,
  verifyWechatPayCallbackSignature,
  fetchJson
}
