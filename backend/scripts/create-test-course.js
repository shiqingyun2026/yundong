require('dotenv').config()

const supabase = require('../utils/supabase')

const DEFAULT_TEST_OPEN_ID = 'seed0326_u02'
const JOINABLE_GROUP_OWNER_OPEN_ID = 'seed0326_u01'

const SERVICE_QR_CODE =
  'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D'

const COURSE_SCENARIOS = {
  createGroup: {
    name: '[回归测试] 无活跃拼团课程',
    cover: 'https://dummyimage.com/960x540/e8f4ff/21598a.png&text=%E7%AB%8B%E5%8D%B3%E5%BC%80%E5%9B%A2',
    images: [
      'https://dummyimage.com/1280x720/e8f4ff/21598a.png&text=Create+Group+01',
      'https://dummyimage.com/1280x720/d5ebff/21598a.png&text=Create+Group+02'
    ],
    address: '深圳市南山区科技园邻动回归训练点',
    locationDistrict: '南山区',
    locationCommunity: '科技园社区',
    locationDetail: '科技园邻动回归训练点 A 场',
    longitude: 113.9512,
    latitude: 22.5431,
    startDays: 6,
    durationHours: 2,
    publishOffsetDays: -2,
    deadlineOffsetDays: 2,
    groupPrice: 88,
    originalPrice: 168,
    defaultTargetCount: 2,
    maxGroups: 3,
    ageLimit: '4-7岁',
    coachName: '回归教练 A',
    coachIntro: '用于验证“立即开团 -> 确认支付 -> mock success”链路。',
    coachCertificates: ['https://dummyimage.com/480x320/e8f4ff/21598a.png&text=Coach+Create'],
    insuranceDesc: '回归测试课程默认附带意外险说明。',
    description:
      '<p>该课程用于验证当前固定 mock 用户的“立即开团”链路，脚本会保证它始终处于可创建新团的状态。</p>'
  },
  joinGroup: {
    name: '[回归测试] 可直接参团课程',
    cover: 'https://dummyimage.com/960x540/fff3de/8a5a12.png&text=%E5%8E%BB%E5%8F%82%E5%9B%A2',
    images: [
      'https://dummyimage.com/1280x720/fff3de/8a5a12.png&text=Join+Group+01',
      'https://dummyimage.com/1280x720/ffe7c7/8a5a12.png&text=Join+Group+02'
    ],
    address: '深圳市福田区香蜜公园邻动训练区',
    locationDistrict: '福田区',
    locationCommunity: '香蜜社区',
    locationDetail: '香蜜公园邻动训练区 2 号草坪',
    longitude: 114.0417,
    latitude: 22.5498,
    startDays: 5,
    durationHours: 2,
    publishOffsetDays: -2,
    deadlineOffsetDays: 2,
    groupPrice: 99,
    originalPrice: 179,
    defaultTargetCount: 2,
    maxGroups: 3,
    ageLimit: '5-8岁',
    coachName: '回归教练 B',
    coachIntro: '用于验证“去参团 -> 确认支付 -> mock success”链路。',
    coachCertificates: ['https://dummyimage.com/480x320/fff3de/8a5a12.png&text=Coach+Join'],
    insuranceDesc: '回归测试课程默认附带意外险说明。',
    description:
      '<p>该课程会被重置成“已有 1 人在团内、当前 mock 用户尚未参团”的状态，方便直接验证参团流程。</p>'
  }
}

const addDays = (days, options = {}) => {
  const {
    hour = 18,
    minute = 0,
    second = 0
  } = options
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, second, 0)
  return date.toISOString()
}

const addHours = hours => {
  const date = new Date()
  date.setTime(date.getTime() + hours * 60 * 60 * 1000)
  return date.toISOString()
}

const maybeSingleByName = async table => {
  const { data, error } = await table

  if (error) {
    throw error
  }

  return data || null
}

const ensureUser = async ({ openid, nickname, avatarUrl }) => {
  const existingUser = await maybeSingleByName(
    supabase
      .from('users')
      .select('id, openid, nickname')
      .eq('openid', openid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  if (existingUser) {
    return existingUser
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      openid,
      nickname,
      avatar_url: avatarUrl
    })
    .select('id, openid, nickname')
    .single()

  if (error) {
    throw error
  }

  return data
}

const buildCoursePayload = scenario => {
  const startTime = addDays(scenario.startDays, { hour: 10 })
  const endTime = addDays(scenario.startDays, { hour: 12 })

  return {
    name: scenario.name,
    cover: scenario.cover,
    images: scenario.images,
    address: scenario.address,
    location_district: scenario.locationDistrict,
    location_community: scenario.locationCommunity,
    location_detail: scenario.locationDetail,
    longitude: scenario.longitude,
    latitude: scenario.latitude,
    start_time: startTime,
    end_time: endTime,
    publish_time: addDays(scenario.publishOffsetDays, { hour: 9 }),
    unpublish_time: null,
    deadline: addDays(scenario.deadlineOffsetDays, { hour: 20 }),
    group_price: scenario.groupPrice,
    original_price: scenario.originalPrice,
    default_target_count: scenario.defaultTargetCount,
    max_groups: scenario.maxGroups,
    age_limit: scenario.ageLimit,
    coach_name: scenario.coachName,
    coach_intro: scenario.coachIntro,
    coach_certificates: scenario.coachCertificates,
    insurance_desc: scenario.insuranceDesc,
    service_qr_code: SERVICE_QR_CODE,
    description: scenario.description,
    status: 1,
    updated_at: new Date().toISOString()
  }
}

const ensureCourse = async scenario => {
  const existingCourse = await maybeSingleByName(
    supabase
      .from('courses')
      .select('id, name')
      .eq('name', scenario.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  const payload = buildCoursePayload(scenario)

  if (existingCourse) {
    const { data, error } = await supabase
      .from('courses')
      .update(payload)
      .eq('id', existingCourse.id)
      .select('id, name, deadline, start_time')
      .single()

    if (error) {
      throw error
    }

    return data
  }

  const { data, error } = await supabase
    .from('courses')
    .insert(payload)
    .select('id, name, deadline, start_time')
    .single()

  if (error) {
    throw error
  }

  return data
}

const deleteAdminLogs = async targetIds => {
  const uniqueTargetIds = [...new Set((targetIds || []).filter(Boolean))]
  if (!uniqueTargetIds.length) {
    return
  }

  const { error } = await supabase
    .from('admin_log')
    .delete()
    .in('target_id', uniqueTargetIds)

  if (error) {
    throw error
  }
}

const resetCourseScenario = async courseId => {
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id')
    .eq('course_id', courseId)

  if (groupsError) {
    throw groupsError
  }

  const groupIds = (groups || []).map(item => item.id).filter(Boolean)

  const { data: orders, error: ordersQueryError } = await supabase
    .from('orders')
    .select('id')
    .eq('course_id', courseId)

  if (ordersQueryError) {
    throw ordersQueryError
  }

  const orderIds = (orders || []).map(item => item.id).filter(Boolean)

  if (orderIds.length) {
    const { error: deleteOrdersError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds)

    if (deleteOrdersError) {
      throw deleteOrdersError
    }
  }

  if (groupIds.length) {
    const { error: deleteMembersError } = await supabase
      .from('group_members')
      .delete()
      .in('group_id', groupIds)

    if (deleteMembersError) {
      throw deleteMembersError
    }

    const { error: deleteGroupsError } = await supabase
      .from('groups')
      .delete()
      .in('id', groupIds)

    if (deleteGroupsError) {
      throw deleteGroupsError
    }
  }

  await deleteAdminLogs([courseId, ...groupIds, ...orderIds])
}

const seedJoinableGroupScenario = async ({ course, ownerUser }) => {
  const expireTime = course.deadline || addDays(2, { hour: 20 })
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      course_id: course.id,
      creator_id: ownerUser.id,
      status: 'active',
      current_count: 1,
      target_count: 2,
      expire_time: expireTime,
      created_at: addHours(-3)
    })
    .select('id, status, current_count, target_count, expire_time')
    .single()

  if (groupError) {
    throw groupError
  }

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: ownerUser.id,
      joined_at: addHours(-2)
    })

  if (memberError) {
    throw memberError
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: ownerUser.id,
      course_id: course.id,
      group_id: group.id,
      amount: COURSE_SCENARIOS.joinGroup.groupPrice,
      status: 'success',
      pay_time: addHours(-2),
      updated_at: addHours(-2)
    })
    .select('id, order_no')
    .single()

  if (orderError) {
    throw orderError
  }

  return {
    group,
    order
  }
}

async function main() {
  const defaultMockUser = await ensureUser({
    openid: DEFAULT_TEST_OPEN_ID,
    nickname: '测试家长02',
    avatarUrl: 'https://dummyimage.com/120x120/caffbf/245b3b.png&text=U02'
  })

  const groupOwnerUser = await ensureUser({
    openid: JOINABLE_GROUP_OWNER_OPEN_ID,
    nickname: '测试家长01',
    avatarUrl: 'https://dummyimage.com/120x120/ffd6a5/6b3f1d.png&text=U01'
  })

  const createGroupCourse = await ensureCourse(COURSE_SCENARIOS.createGroup)
  await resetCourseScenario(createGroupCourse.id)

  const joinGroupCourse = await ensureCourse(COURSE_SCENARIOS.joinGroup)
  await resetCourseScenario(joinGroupCourse.id)
  const joinableSeed = await seedJoinableGroupScenario({
    course: joinGroupCourse,
    ownerUser: groupOwnerUser
  })

  console.log(
    JSON.stringify(
      {
        defaultMockOpenId: DEFAULT_TEST_OPEN_ID,
        defaultMockUserId: defaultMockUser.id,
        scenarios: {
          createGroup: {
            courseId: createGroupCourse.id,
            courseName: createGroupCourse.name,
            action: '立即开团'
          },
          joinGroup: {
            courseId: joinGroupCourse.id,
            courseName: joinGroupCourse.name,
            groupId: joinableSeed.group.id,
            seededOwnerOpenId: JOINABLE_GROUP_OWNER_OPEN_ID,
            action: '去参团'
          }
        }
      },
      null,
      2
    )
  )
}

main().catch(error => {
  console.error(
    JSON.stringify({
      error: error.message || String(error)
    })
  )
  process.exit(1)
})
