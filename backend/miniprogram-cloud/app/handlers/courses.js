const supabase = require('../../../utils/supabase')
const {
  fetchMiniProgramCourseActiveGroup,
  fetchMiniProgramCourseDetail,
  fetchMiniProgramCourseList
} = require('../../../shared/services/courseReaders')
const { readQueryValue, resolveAuthorization } = require('./requestHelpers')
const { resolveUserIdFromAuthorization } = require('../../../shared/utils/auth')

const handleCourseList = async request => {
  return fetchMiniProgramCourseList({
    supabase,
    page: readQueryValue(request, 'page'),
    pageSize: readQueryValue(request, 'pageSize'),
    sort: readQueryValue(request, 'sort')
  })
}

const handleCourseDetail = async request => {
  return fetchMiniProgramCourseDetail({
    supabase,
    courseId: request.params.id
  })
}

const handleCourseActiveGroup = async request => {
  return fetchMiniProgramCourseActiveGroup({
    supabase,
    courseId: request.params.id,
    userId: resolveUserIdFromAuthorization(resolveAuthorization(request))
  })
}

module.exports = {
  handleCourseActiveGroup,
  handleCourseDetail,
  handleCourseList
}
