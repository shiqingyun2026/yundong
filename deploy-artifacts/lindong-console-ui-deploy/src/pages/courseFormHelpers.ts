import type { CourseCategory, CourseDetail, CourseGroupRecord, CourseListItem } from '../types'

export const COURSE_CATEGORY_OPTIONS: CourseCategory[] = ['体适能', '跳绳']

export const emptyCourse: CourseDetail = {
  title: '',
  category: '',
  cover: '',
  description: '',
  age_range: '',
  original_price: 0,
  group_price: 0,
  target_count: 2,
  max_groups: 1,
  publish_time: '',
  unpublish_time: '',
  start_time: '',
  end_time: '',
  location_district: '',
  location_detail: '',
  longitude: null,
  latitude: null,
  deadline: '',
  coach_name: '',
  coach_intro: '',
  coach_cert: [],
  rules: ''
}

export const toDateTimeLocal = (value: string) => (value ? value.slice(0, 16).replace(' ', 'T') : '')

export const getCourseCategoryText = (value?: string | null) => value || '-'

export const normalizeCourseDetail = (
  data: CourseDetail & {
    course_category?: CourseDetail['category']
  }
): CourseDetail => ({
  ...data,
  category: data.category || data.course_category || ''
})

export const normalizeCourseListItem = (
  item: CourseListItem & {
    course_category?: CourseListItem['category']
  }
): CourseListItem => ({
  ...item,
  category: item.category || item.course_category || ''
})

export const getGroupStatusText = (status: CourseGroupRecord['status']) => {
  if (status === 'success') return '已成团'
  if (status === 'failed') return '已失败'
  return '进行中'
}

export const REGION_OPTIONS = [
  {
    label: '广东省',
    value: '广东省',
    cities: [
      {
        label: '深圳市',
        value: '深圳市',
        districts: ['福田区', '罗湖区', '南山区', '宝安区', '龙岗区', '龙华区', '盐田区', '坪山区', '光明区']
      }
    ]
  }
]

export const splitLines = (value: string) =>
  value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)

export const summarizeGroupItems = (groupItems: CourseGroupRecord[]) =>
  groupItems.reduce(
    (result, item) => {
      result.total += 1
      if (item.status === 'active') result.active += 1
      if (item.status === 'success') result.success += 1
      if (item.status === 'failed') result.failed += 1
      return result
    },
    { total: 0, active: 0, success: 0, failed: 0 }
  )
