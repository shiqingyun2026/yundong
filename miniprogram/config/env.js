const ENV_API_BASE_URLS = {
  develop: '',
  trial: '',
  release: ''
}

const ENV_API_TRANSPORTS = {
  develop: 'container',
  trial: 'container',
  release: 'container'
}

const ENV_PAYMENT_PROVIDERS = {
  develop: 'wechat',
  trial: 'wechat',
  release: 'wechat'
}

const CLOUD_ENV_PLACEHOLDER = 'TODO_WECHAT_CLOUD_ENV'
const CLOUD_CONTAINER_SERVICE_PLACEHOLDER = 'TODO_CLOUD_RUN_SERVICE'
const CLOUD_LOCATION_FUNCTION_PLACEHOLDER = 'TODO_CLOUD_LOCATION_FUNCTION'

const ENV_CLOUD_ENVS = {
  develop: 'tttiyubao-4g141829bdf6a28d',
  trial: 'tttiyubao-4g141829bdf6a28d',
  release: 'tttiyubao-4g141829bdf6a28d'
}

const ENV_CLOUD_CONTAINER_SERVICE_NAMES = {
  develop: 'lindong-api-test',
  trial: 'lindong-api-test',
  release: 'lindong-api'
}

const ENV_CLOUD_LOCATION_FUNCTION_NAMES = {
  develop: 'ip-geolocation',
  trial: 'ip-geolocation',
  release: 'ip-geolocation'
}

const SUBSCRIBE_TEMPLATE_PLACEHOLDER = 'TODO_SUBSCRIBE_TEMPLATE_ID'
const GROUP_SUCCESS_TEMPLATE_ID = 'S6VR9rfzWPlpFRfZLNpjJzxEyPHEGQDd7KQ-TOHduxc'
const GROUP_FAIL_TEMPLATE_ID = 'aXcNy9Dg_lyqbI2RAbpPvRao7reiH2wVBa1WsFi5dp4'
const ENV_SUBSCRIBE_TEMPLATE_IDS = {
  develop: {
    groupSuccess: GROUP_SUCCESS_TEMPLATE_ID,
    groupFail: GROUP_FAIL_TEMPLATE_ID
  },
  trial: {
    groupSuccess: GROUP_SUCCESS_TEMPLATE_ID,
    groupFail: GROUP_FAIL_TEMPLATE_ID
  },
  release: {
    groupSuccess: GROUP_SUCCESS_TEMPLATE_ID,
    groupFail: GROUP_FAIL_TEMPLATE_ID
  }
}

const getMiniProgramEnvVersion = () => {
  try {
    const accountInfo = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || 'develop'
  } catch (error) {
    return 'develop'
  }
}

const resolveBaseURLByEnv = envVersion => ENV_API_BASE_URLS[envVersion] || ENV_API_BASE_URLS.develop
const resolveApiTransportByEnv = envVersion => ENV_API_TRANSPORTS[envVersion] || ENV_API_TRANSPORTS.develop
const resolvePaymentProviderByEnv = envVersion =>
  `${ENV_PAYMENT_PROVIDERS[envVersion] || ENV_PAYMENT_PROVIDERS.develop || 'mock'}`.trim().toLowerCase()
const resolveCloudEnvByEnv = envVersion => {
  const value = ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop
  return value === CLOUD_ENV_PLACEHOLDER ? '' : value
}
const resolveCloudContainerServiceNameByEnv = envVersion => {
  const value =
    ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop
  return value === CLOUD_CONTAINER_SERVICE_PLACEHOLDER ? '' : value
}
const resolveCloudLocationFunctionNameByEnv = envVersion => {
  const value =
    ENV_CLOUD_LOCATION_FUNCTION_NAMES[envVersion] || ENV_CLOUD_LOCATION_FUNCTION_NAMES.develop
  return value === CLOUD_LOCATION_FUNCTION_PLACEHOLDER ? '' : value
}
const isCloudEnvConfigured = envVersion =>
  !!(ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop) &&
  (ENV_CLOUD_ENVS[envVersion] || ENV_CLOUD_ENVS.develop) !== CLOUD_ENV_PLACEHOLDER
const isCloudContainerServiceConfigured = envVersion =>
  !!(ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop) &&
  (ENV_CLOUD_CONTAINER_SERVICE_NAMES[envVersion] || ENV_CLOUD_CONTAINER_SERVICE_NAMES.develop) !==
    CLOUD_CONTAINER_SERVICE_PLACEHOLDER
const isCloudLocationFunctionConfigured = envVersion =>
  !!(
    ENV_CLOUD_LOCATION_FUNCTION_NAMES[envVersion] || ENV_CLOUD_LOCATION_FUNCTION_NAMES.develop
  ) &&
  (ENV_CLOUD_LOCATION_FUNCTION_NAMES[envVersion] || ENV_CLOUD_LOCATION_FUNCTION_NAMES.develop) !==
    CLOUD_LOCATION_FUNCTION_PLACEHOLDER
const resolveSubscribeTemplateIdsByEnv = envVersion => {
  const value = ENV_SUBSCRIBE_TEMPLATE_IDS[envVersion] || ENV_SUBSCRIBE_TEMPLATE_IDS.develop
  const normalize = templateId =>
    templateId && templateId !== SUBSCRIBE_TEMPLATE_PLACEHOLDER ? templateId : ''

  return {
    groupSuccess: normalize(value && value.groupSuccess),
    groupFail: normalize(value && value.groupFail)
  }
}

module.exports = {
  ENV_API_BASE_URLS,
  ENV_API_TRANSPORTS,
  ENV_PAYMENT_PROVIDERS,
  CLOUD_ENV_PLACEHOLDER,
  CLOUD_CONTAINER_SERVICE_PLACEHOLDER,
  CLOUD_LOCATION_FUNCTION_PLACEHOLDER,
  ENV_CLOUD_ENVS,
  ENV_CLOUD_CONTAINER_SERVICE_NAMES,
  ENV_CLOUD_LOCATION_FUNCTION_NAMES,
  ENV_SUBSCRIBE_TEMPLATE_IDS,
  SUBSCRIBE_TEMPLATE_PLACEHOLDER,
  GROUP_SUCCESS_TEMPLATE_ID,
  GROUP_FAIL_TEMPLATE_ID,
  getMiniProgramEnvVersion,
  resolveBaseURLByEnv,
  resolveApiTransportByEnv,
  resolvePaymentProviderByEnv,
  resolveCloudEnvByEnv,
  resolveCloudContainerServiceNameByEnv,
  resolveCloudLocationFunctionNameByEnv,
  resolveSubscribeTemplateIdsByEnv,
  isCloudEnvConfigured,
  isCloudContainerServiceConfigured,
  isCloudLocationFunctionConfigured
}
