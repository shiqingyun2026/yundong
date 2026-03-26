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
  publish_time: string
  unpublish_time: string
  deadline: string
  start_time: string
  end_time: string
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
  description: string
  age_range: string
  original_price: number
  group_price: number
  target_count: number
  max_groups: number
  publish_time: string
  unpublish_time: string
  start_time: string
  end_time: string
  location_district: string
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
  refund_time: string
  refund_reason: string
  refund_type: '' | 'system' | 'manual'
}

export interface OrderDetail {
  id: string
  order_no: string
  amount: number
  status: number
  create_time: string
  pay_time: string
  refund_time: string
  refund_reason: string
  refund_type: '' | 'system' | 'manual'
  user: {
    id: string
    nick_name: string
    phone: string
    avatar_url: string
  }
  course: {
    id: string
    title: string
    start_time: string
    end_time: string
    location_detail: string
  }
  group: {
    id: string
    current_count: number
    target_count: number
    status: number
  }
}

export interface AccountListItem {
  id: string
  username: string
  role: string
  status: string
  last_login_time: string
  create_time: string
}

export interface GroupListItem {
  id: string
  course_id: string
  course_title: string
  status: 'active' | 'success' | 'failed'
  current_count: number
  target_count: number
  creator_name: string
  expire_time: string
  create_time: string
}

export interface GroupOrderItem {
  id: string
  order_no: string
  user_nick_name: string
  amount: number
  status: string
  create_time: string
  pay_time: string
  refund_time: string
  refund_reason: string
  refund_type: '' | 'system' | 'manual'
}

export interface GroupDetail {
  id: string
  course_id: string
  course_title: string
  creator_name: string
  status: 'active' | 'success' | 'failed'
  current_count: number
  target_count: number
  expire_time: string
  create_time: string
  deadline: string
  start_time: string
  end_time: string
  rules: string[]
  anomalies: string[]
  members: Array<{
    user_id: string
    nick_name: string
    avatar_url: string
    joined_at: string
    order_no: string
    order_status: string
  }>
  orders: GroupOrderItem[]
}
