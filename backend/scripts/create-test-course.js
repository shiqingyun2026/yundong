require('dotenv').config()

const supabase = require('../utils/supabase')

const TEST_COURSE_NAME = '[回归测试] 无活跃拼团课程'
const TEST_DESCRIPTION_HTML = `
  <div style="margin-bottom: 16px;">
    <p style="line-height: 1.8; color: #3c4655;">
      这是一门用于回归测试的课程详情富文本示例，正文中包含图片、段落和强调信息，便于验证小程序 rich-text 渲染效果。
    </p>
  </div>
  <div style="margin: 20px 0;">
    <img
      src="https://picsum.photos/960/540?random=504"
      style="width: 100%; border-radius: 12px; display: block;"
    />
  </div>
  <div>
    <p style="line-height: 1.8; color: #3c4655;">
      课程亮点：趣味热身、基础协调训练、分组互动游戏和课后拉伸，适合图文混排展示验证。
    </p>
  </div>
`.trim()

const addDays = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(18, 0, 0, 0)
  return date.toISOString()
}

async function main() {
  const { data: existingCourse, error: queryError } = await supabase
    .from('courses')
    .select('id, name, start_time')
    .eq('name', TEST_COURSE_NAME)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (queryError) {
    throw queryError
  }

  if (existingCourse) {
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        description: TEST_DESCRIPTION_HTML
      })
      .eq('id', existingCourse.id)

    if (updateError) {
      throw updateError
    }

    console.log(
      JSON.stringify({
        created: false,
        courseId: existingCourse.id,
        name: existingCourse.name,
        startTime: existingCourse.start_time
      })
    )
    return
  }

  const payload = {
    name: TEST_COURSE_NAME,
    cover: 'https://picsum.photos/200/150?random=501',
    images: [
      'https://picsum.photos/800/600?random=501',
      'https://picsum.photos/800/600?random=502'
    ],
    address: '深圳市南山区回归测试运动场',
    start_time: addDays(10),
    group_price: 88,
    original_price: 168,
    age_limit: '5-8岁',
    coach_name: '测试教练',
    coach_intro: '用于回归测试的课程数据，请勿用于正式运营。',
    coach_certificates: ['https://picsum.photos/240/160?random=503'],
    insurance_desc: '回归测试课程默认保险说明。',
    service_qr_code: 'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    description: TEST_DESCRIPTION_HTML
  }

  const { data: insertedCourse, error: insertError } = await supabase
    .from('courses')
    .insert(payload)
    .select('id, name, start_time')
    .single()

  if (insertError) {
    throw insertError
  }

  console.log(
    JSON.stringify({
      created: true,
      courseId: insertedCourse.id,
      name: insertedCourse.name,
      startTime: insertedCourse.start_time
    })
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
