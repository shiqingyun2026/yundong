export type CourseCategory = '体适能' | '跳绳'

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
  category: CourseCategory | ''
  publish_time: string
  unpublish_time: string
  deadline: string
  start_time: string
  end_time: string
  location_district: string
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
  category: CourseCategory | ''
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

export interface AdminLogItem {
  id: number
  admin_id: string
  admin_username: string
  admin_role: string
  action: string
  target_type: string
  target_id: string
  detail: Record<string, unknown>
  ip: string
  created_at: string
}

export interface AdminLogListResponse {
  total: number
  total_pages: number
  page: number
  size: number
  list: AdminLogItem[]
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

export interface CourseGroupRecord {
  id: string
  course_id: string
  status: 'active' | 'success' | 'failed'
  current_count: number
  target_count: number
  creator_name: string
  expire_time: string
  create_time: string
}

export interface GroupListResponse {
  total: number
  page: number
  size: number
  total_pages: number
  summary: {
    total: number
    active: number
    success: number
    failed: number
  }
  list: GroupListItem[]
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
  course_status: number
  course_status_text: string
  publish_time: string
  unpublish_time: string
  deadline: string
  start_time: string
  end_time: string
  refund_order_count: number
  paid_order_count: number
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

export interface DashboardMetric {
  current: number
  previous: number | null
  delta: number | null
  direction: 'up' | 'down' | 'flat' | 'none'
}

export interface DashboardOverview {
  range: {
    key: 'today' | '7d' | '30d'
    label: string
    days: number
    compare_label: string
    start_date: string
    end_date: string
    display_text: string
  }
  metrics: {
    grouping_course_count: DashboardMetric
    class_course_count: DashboardMetric
    publish_course_count: DashboardMetric
    success_group_count: DashboardMetric
    group_member_count: DashboardMetric
    successful_group_amount: DashboardMetric
  }
  anomalies: {
    failed_group_pending_refund_count: number
    expired_active_group_count: number
    member_mismatch_group_count: number
    auto_refund_order_count: number
  }
  note: string
}
