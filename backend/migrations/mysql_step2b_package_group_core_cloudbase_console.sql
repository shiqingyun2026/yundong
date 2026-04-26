-- 课包拼团 V2.2 CloudBase SQL 控制台兼容版结构迁移
-- 用法：
-- 1. 先执行本文件“建表段”
-- 2. 再逐条执行“补字段段”和“补索引段”
-- 3. 如果某条 ALTER 报 Duplicate column/index，可以跳过该条继续执行后面的语句

-- 建表段
CREATE TABLE IF NOT EXISTS `course_packages` (
  id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  cover VARCHAR(1024) DEFAULT NULL,
  images TEXT,
  total_price INT DEFAULT 0,
  package_category VARCHAR(20) NOT NULL DEFAULT '体适能',
  age_range VARCHAR(100) NOT NULL DEFAULT '',
  supported_people VARCHAR(32) DEFAULT NULL,
  location_district VARCHAR(50) DEFAULT NULL,
  location_community VARCHAR(50) DEFAULT NULL,
  location_detail VARCHAR(100) DEFAULT NULL,
  longitude DECIMAL(10,7) NULL,
  latitude DECIMAL(10,7) NULL,
  coach_name VARCHAR(50) DEFAULT NULL,
  coach_intro TEXT,
  coach_certificates TEXT,
  description MEDIUMTEXT,
  deadline_hours INT DEFAULT 48,
  status INT DEFAULT 0,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  created_by VARCHAR(36) NULL,
  updated_by VARCHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_course_packages_status (status),
  KEY idx_course_packages_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS `package_groups` (
  id VARCHAR(36) NOT NULL,
  package_id VARCHAR(36) NOT NULL,
  creator_id VARCHAR(36) NULL,
  target_count INT DEFAULT 0,
  current_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  weekday TINYINT UNSIGNED NOT NULL,
  hour TINYINT UNSIGNED NOT NULL,
  first_class_time DATETIME NULL,
  deadline DATETIME NOT NULL,
  created_at DATETIME NULL,
  success_time DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_package_groups_package_status_deadline (package_id, status, deadline),
  KEY idx_package_groups_creator_id (creator_id),
  KEY idx_package_groups_created_at (created_at)
);

-- 补字段段
ALTER TABLE `orders` MODIFY COLUMN `course_id` VARCHAR(36) NULL;
ALTER TABLE `orders` MODIFY COLUMN `group_id` VARCHAR(36) NULL;
ALTER TABLE `payment_records` MODIFY COLUMN `course_id` VARCHAR(36) NULL;
ALTER TABLE `payment_records` MODIFY COLUMN `group_id` VARCHAR(36) NULL;

ALTER TABLE `orders` ADD COLUMN `order_type` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `user_id`;
ALTER TABLE `orders` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`;
ALTER TABLE `orders` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`;
ALTER TABLE `orders` ADD COLUMN `package_action` VARCHAR(10) NULL AFTER `package_group_id`;
ALTER TABLE `orders` ADD COLUMN `package_context` TEXT NULL AFTER `package_action`;

ALTER TABLE `payment_records` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`;
ALTER TABLE `payment_records` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`;

-- 补索引段
ALTER TABLE `orders` ADD KEY `idx_orders_order_type_status_created_at` (`order_type`, `status`, `created_at`);
ALTER TABLE `orders` ADD KEY `idx_orders_package_status_created_at` (`package_id`, `status`, `created_at`);
ALTER TABLE `orders` ADD KEY `idx_orders_package_group_status_created_at` (`package_group_id`, `status`, `created_at`);
ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_id` (`package_id`);
ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_group_id` (`package_group_id`);
