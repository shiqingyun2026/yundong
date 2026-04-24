CREATE TABLE IF NOT EXISTS `admin_users` (
  id CHAR(36) NOT NULL,
  email VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash TEXT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login DATETIME NULL,
  password_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_admin_users_email (email),
  UNIQUE KEY uniq_admin_users_username (username),
  KEY idx_admin_users_role (role),
  KEY idx_admin_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  id CHAR(36) NOT NULL,
  openid VARCHAR(128) NOT NULL,
  nickname VARCHAR(100) NOT NULL DEFAULT '',
  avatar_url VARCHAR(1024) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_openid (openid),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `courses` (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  course_category VARCHAR(20) NOT NULL DEFAULT '体适能',
  cover VARCHAR(1024) NOT NULL DEFAULT '',
  images JSON NULL,
  description MEDIUMTEXT NULL,
  age_limit VARCHAR(100) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  location_district VARCHAR(100) NOT NULL DEFAULT '',
  location_community VARCHAR(100) NOT NULL DEFAULT '',
  location_detail VARCHAR(255) NOT NULL DEFAULT '',
  longitude DECIMAL(10, 6) NULL,
  latitude DECIMAL(10, 6) NULL,
  group_price INT NOT NULL DEFAULT 0,
  original_price INT NOT NULL DEFAULT 0,
  publish_time DATETIME NULL,
  unpublish_time DATETIME NULL,
  deadline DATETIME NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  default_target_count INT NULL,
  max_groups INT NOT NULL DEFAULT 0,
  status TINYINT UNSIGNED NOT NULL DEFAULT 0,
  coach_name VARCHAR(100) NOT NULL DEFAULT '',
  coach_intro TEXT NULL,
  coach_certificates JSON NULL,
  rules TEXT NULL,
  insurance_desc TEXT NULL,
  service_qr_code VARCHAR(1024) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_courses_course_category (course_category),
  KEY idx_courses_status (status),
  KEY idx_courses_publish_time (publish_time),
  KEY idx_courses_unpublish_time (unpublish_time),
  KEY idx_courses_deadline (deadline),
  KEY idx_courses_start_time (start_time),
  CONSTRAINT fk_courses_created_by FOREIGN KEY (created_by) REFERENCES `admin_users`(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_courses_updated_by FOREIGN KEY (updated_by) REFERENCES `admin_users`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_packages` (
  id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  cover VARCHAR(1024) NOT NULL DEFAULT '',
  images JSON NULL,
  total_price INT NOT NULL DEFAULT 0,
  package_category VARCHAR(20) NOT NULL DEFAULT '体适能',
  supported_people VARCHAR(32) NOT NULL DEFAULT '',
  location_district VARCHAR(50) NOT NULL DEFAULT '',
  location_community VARCHAR(50) NOT NULL DEFAULT '',
  location_detail VARCHAR(100) NOT NULL DEFAULT '',
  longitude DECIMAL(10, 7) NULL,
  latitude DECIMAL(10, 7) NULL,
  coach_name VARCHAR(50) NOT NULL DEFAULT '',
  coach_intro TEXT NULL,
  coach_certificates JSON NULL,
  description MEDIUMTEXT NULL,
  deadline_hours INT NOT NULL DEFAULT 48,
  status TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_course_packages_status (status),
  KEY idx_course_packages_created_at (created_at),
  CONSTRAINT fk_course_packages_created_by FOREIGN KEY (created_by) REFERENCES `admin_users`(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_course_packages_updated_by FOREIGN KEY (updated_by) REFERENCES `admin_users`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  creator_id CHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_count INT NOT NULL DEFAULT 0,
  target_count INT NOT NULL DEFAULT 0,
  expire_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success_time DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_groups_course_status_expire (course_id, status, expire_time),
  KEY idx_groups_course_created_at (course_id, created_at),
  KEY idx_groups_creator_id (creator_id),
  CONSTRAINT fk_groups_course_id FOREIGN KEY (course_id) REFERENCES `courses`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_groups_creator_id FOREIGN KEY (creator_id) REFERENCES `users`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `package_groups` (
  id CHAR(36) NOT NULL,
  package_id CHAR(36) NOT NULL,
  creator_id CHAR(36) NULL,
  target_count INT NOT NULL DEFAULT 0,
  current_count INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  weekday TINYINT UNSIGNED NOT NULL,
  hour TINYINT UNSIGNED NOT NULL,
  first_class_time DATETIME NULL,
  deadline DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success_time DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_package_groups_package_status_deadline (package_id, status, deadline),
  KEY idx_package_groups_creator_id (creator_id),
  KEY idx_package_groups_created_at (created_at),
  CONSTRAINT fk_package_groups_package_id FOREIGN KEY (package_id) REFERENCES `course_packages`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_package_groups_creator_id FOREIGN KEY (creator_id) REFERENCES `users`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_members` (
  group_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  KEY idx_group_members_user_joined (user_id, joined_at),
  KEY idx_group_members_group_joined (group_id, joined_at),
  CONSTRAINT fk_group_members_group_id FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_group_members_user_id FOREIGN KEY (user_id) REFERENCES `users`(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  id CHAR(36) NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  user_id CHAR(36) NOT NULL,
  order_type TINYINT UNSIGNED NOT NULL DEFAULT 1,
  course_id CHAR(36) NULL,
  group_id CHAR(36) NULL,
  package_id CHAR(36) NULL,
  package_group_id CHAR(36) NULL,
  package_action VARCHAR(10) NULL,
  package_context JSON NULL,
  amount INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pay_time DATETIME NULL,
  refund_time DATETIME NULL,
  refund_reason TEXT NULL,
  refund_operator_id CHAR(36) NULL,
  transaction_id VARCHAR(64) NOT NULL DEFAULT '',
  pending_user_course_key VARCHAR(73)
    GENERATED ALWAYS AS (
      CASE
        WHEN order_type = 1 AND status = 'pending' AND course_id IS NOT NULL THEN CONCAT(user_id, ':', course_id)
        ELSE NULL
      END
    ) STORED,
  pending_user_package_key VARCHAR(73)
    GENERATED ALWAYS AS (
      CASE
        WHEN order_type = 2 AND status = 'pending' AND package_id IS NOT NULL THEN CONCAT(user_id, ':', package_id)
        ELSE NULL
      END
    ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_orders_order_no (order_no),
  UNIQUE KEY uniq_orders_pending_user_course (pending_user_course_key),
  UNIQUE KEY uniq_orders_pending_user_package (pending_user_package_key),
  KEY idx_orders_user_status_created_at (user_id, status, created_at),
  KEY idx_orders_order_type_status_created_at (order_type, status, created_at),
  KEY idx_orders_course_status_created_at (course_id, status, created_at),
  KEY idx_orders_group_status_created_at (group_id, status, created_at),
  KEY idx_orders_package_status_created_at (package_id, status, created_at),
  KEY idx_orders_package_group_status_created_at (package_group_id, status, created_at),
  KEY idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES `users`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_course_id FOREIGN KEY (course_id) REFERENCES `courses`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_group_id FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_package_id FOREIGN KEY (package_id) REFERENCES `course_packages`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_package_group_id FOREIGN KEY (package_group_id) REFERENCES `package_groups`(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_refund_operator_id FOREIGN KEY (refund_operator_id) REFERENCES `admin_users`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_records` (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NULL,
  group_id CHAR(36) NULL,
  package_id CHAR(36) NULL,
  package_group_id CHAR(36) NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'wechat',
  channel VARCHAR(30) NOT NULL DEFAULT 'mini_program',
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'mock',
  out_trade_no VARCHAR(64) NOT NULL,
  transaction_id VARCHAR(64) NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  callback_status VARCHAR(32) NOT NULL DEFAULT '',
  prepare_payload JSON NULL,
  callback_payload JSON NULL,
  paid_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_payment_records_order_id (order_id),
  UNIQUE KEY uniq_payment_records_out_trade_no (out_trade_no),
  KEY idx_payment_records_status (status),
  KEY idx_payment_records_user_id (user_id),
  KEY idx_payment_records_group_id (group_id),
  KEY idx_payment_records_package_id (package_id),
  KEY idx_payment_records_package_group_id (package_group_id),
  CONSTRAINT fk_payment_records_order_id FOREIGN KEY (order_id) REFERENCES `orders`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_records_user_id FOREIGN KEY (user_id) REFERENCES `users`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payment_records_course_id FOREIGN KEY (course_id) REFERENCES `courses`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payment_records_group_id FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payment_records_package_id FOREIGN KEY (package_id) REFERENCES `course_packages`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payment_records_package_group_id FOREIGN KEY (package_group_id) REFERENCES `package_groups`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_result_subscriptions` (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  group_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  scene VARCHAR(50) NOT NULL DEFAULT 'group_result',
  template_key VARCHAR(100) NOT NULL,
  template_id VARCHAR(255) NOT NULL DEFAULT '',
  decision VARCHAR(20) NOT NULL DEFAULT 'unknown',
  status VARCHAR(20) NOT NULL DEFAULT 'unsubscribed',
  reason VARCHAR(255) NOT NULL DEFAULT '',
  raw_result JSON NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_group_result_subscriptions_user_group_template (user_id, group_id, template_key),
  KEY idx_group_result_subscriptions_group_id (group_id),
  KEY idx_group_result_subscriptions_course_id (course_id),
  KEY idx_group_result_subscriptions_status (status),
  CONSTRAINT fk_group_result_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES `users`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_group_result_subscriptions_group_id FOREIGN KEY (group_id) REFERENCES `package_groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_group_result_subscriptions_course_id FOREIGN KEY (course_id) REFERENCES `course_packages`(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `group_result_notification_jobs` (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  group_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  result_type VARCHAR(20) NOT NULL,
  template_id VARCHAR(255) NOT NULL DEFAULT '',
  page_path VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  message_snapshot JSON NULL,
  subscription_requested_at DATETIME NULL,
  sent_at DATETIME NULL,
  failure_reason VARCHAR(1024) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_group_result_notification_jobs_user_group_result (user_id, group_id, result_type),
  KEY idx_group_result_notification_jobs_status_created_at (status, created_at),
  KEY idx_group_result_notification_jobs_group_id (group_id),
  CONSTRAINT fk_group_result_notification_jobs_user_id FOREIGN KEY (user_id) REFERENCES `users`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_group_result_notification_jobs_group_id FOREIGN KEY (group_id) REFERENCES `package_groups`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_group_result_notification_jobs_course_id FOREIGN KEY (course_id) REFERENCES `course_packages`(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_log` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id CHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(100) NULL,
  detail JSON NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_log_admin_id (admin_id),
  KEY idx_admin_log_action (action),
  KEY idx_admin_log_created_at (created_at),
  CONSTRAINT fk_admin_log_admin_id FOREIGN KEY (admin_id) REFERENCES `admin_users`(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 可选验证：
-- SHOW TABLES;
-- SELECT COUNT(*) AS user_count FROM users;
-- SELECT COUNT(*) AS course_count FROM courses;
