const supabase = require('../../../utils/supabase')
const { loginMiniProgramUser } = require('../../../shared/services/miniProgramAuth')

const handleLogin = async request => {
  const payload = request.data || {}

  return loginMiniProgramUser({
    supabase,
    code: payload.code,
    mockOpenId: payload.mockOpenId,
    openId: request.userContext && request.userContext.openId
  })
}

module.exports = {
  handleLogin
}
