export interface AdminUser {
  id: string
  username: string
  role: 'super_admin' | 'admin'
}

export interface LoginResponse {
  token: string
  user: AdminUser
}

export interface CourseListItem {
  id: string
  title: string
  start_time: string
  end_time: string
  location_community: string
  location_detail: string
  group_price: number
  original_price: number
  target_count: number
  max_groups: number
  status: number
  cover: string
}

export interface CourseDetail {
  id?: string
  title: string
  cover: string
  images: string[]
  description: string
  age_range: string
  original_price: number
  group_price: number
  target_count: number
  max_groups: number
  start_time: string
  end_time: string
  location_district: string
  location_community: string
  location_detail: string
  longitude: number | null
  latitude: number | null
  deadline: string
  coach_name: string
  coach_intro: string
  coach_cert: string[]
  rules?: string
  status?: number
}

export interface OrderListItem {
  id: string
  order_no: string
  user_nick_name: string
  user_phone: string
  course_title: string
  amount: number
  status: number
  create_time: string
  pay_time: string
}

export interface AccountListItem {
  id: string
  username: string
  email: string
  role: string
  status: string
  last_login_time: string
  create_time: string
}
