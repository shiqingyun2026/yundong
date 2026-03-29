const supabase = require('../../../utils/supabase')
const {
  fetchMiniProgramGroupDetail,
  fetchMiniProgramUserGroupList
} = require('../../../shared/services/groupReaders')
const { readQueryValue, requireUserId } = require('./requestHelpers')

const handleGroupDetail = async request => {
  return fetchMiniProgramGroupDetail({
    supabase,
    groupId: request.params.id,
    userId: requireUserId(request)
  })
}

const handleUserGroupList = async request => {
  return fetchMiniProgramUserGroupList({
    supabase,
    userId: requireUserId(request),
    status: readQueryValue(request, 'status'),
    page: readQueryValue(request, 'page'),
    pageSize: readQueryValue(request, 'pageSize')
  })
}

module.exports = {
  handleGroupDetail,
  handleUserGroupList
}
