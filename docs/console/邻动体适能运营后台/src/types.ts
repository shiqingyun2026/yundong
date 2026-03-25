/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CourseStatus {
  ONGOING = '进行中',
  NOT_STARTED = '待开始',
  FINISHED = '已结束',
  UNLISTED = '已下架',
}

export interface Course {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  location: string;
  groupPrice: number;
  originalPrice: number;
  currentEnrollment: number;
  maxCapacity: number;
  status: CourseStatus;
  category: string;
  ageRange: string;
  thumbnail?: string;
  coachName: string;
  coachIntro: string;
  details?: string;
}

export enum OrderStatus {
  PAID = '已支付',
  REFUNDED = '已退款',
  REFUNDING = '退款中',
}

export interface Order {
  id: string;
  userNickname: string;
  userAvatar?: string;
  phone: string;
  courseName: string;
  amount: number;
  status: OrderStatus;
  orderTime: string;
  paymentMethod: string;
  source: string;
}

export enum UserRole {
  SUPER_ADMIN = '超级管理员',
  ADMIN = '管理员',
  COACH = '教练',
  SALES = '销售',
}

export interface Account {
  id: string;
  username: string;
  avatar?: string;
  role: UserRole;
  lastLogin: string;
  createdAt: string;
}
