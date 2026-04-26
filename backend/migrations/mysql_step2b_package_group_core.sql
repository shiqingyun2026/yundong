-- 课包拼团 V2.2 第一阶段 MySQL 结构迁移
-- 执行顺序建议：
-- 1. 已完成 mysql_step0_admin_users.sql / mysql_step1_users.sql / mysql_step2_miniprogram_core.sql
-- 2. 再执行本脚本
-- 3. 如需回归数据，再执行 mysql_step5_seed_package_group.sql

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

ALTER TABLE `orders`
  MODIFY COLUMN `course_id` VARCHAR(36) NULL,
  MODIFY COLUMN `group_id` VARCHAR(36) NULL;

ALTER TABLE `payment_records`
  MODIFY COLUMN `course_id` VARCHAR(36) NULL,
  MODIFY COLUMN `group_id` VARCHAR(36) NULL;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'order_type'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `order_type` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `user_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'package_id'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'package_group_id'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'package_action'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `package_action` VARCHAR(10) NULL AFTER `package_group_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'package_context'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `package_context` TEXT NULL AFTER `package_action`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'pending_user_course_key'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `pending_user_course_key` VARCHAR(73) GENERATED ALWAYS AS (CASE WHEN order_type = 1 AND status = ''pending'' AND course_id IS NOT NULL THEN CONCAT(user_id, '':'', course_id) ELSE NULL END) STORED'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'pending_user_package_key'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `pending_user_package_key` VARCHAR(73) GENERATED ALWAYS AS (CASE WHEN order_type = 2 AND status = ''pending'' AND package_id IS NOT NULL THEN CONCAT(user_id, '':'', package_id) ELSE NULL END) STORED'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND column_name = 'package_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND column_name = 'package_group_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'uniq_orders_pending_user_course'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD UNIQUE KEY `uniq_orders_pending_user_course` (`pending_user_course_key`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'uniq_orders_pending_user_package'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD UNIQUE KEY `uniq_orders_pending_user_package` (`pending_user_package_key`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_order_type_status_created_at'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD KEY `idx_orders_order_type_status_created_at` (`order_type`, `status`, `created_at`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_package_status_created_at'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD KEY `idx_orders_package_status_created_at` (`package_id`, `status`, `created_at`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_package_group_status_created_at'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD KEY `idx_orders_package_group_status_created_at` (`package_group_id`, `status`, `created_at`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND index_name = 'idx_payment_records_package_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_id` (`package_id`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND index_name = 'idx_payment_records_package_group_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_group_id` (`package_group_id`)'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_orders_package_id'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_package_id` FOREIGN KEY (`package_id`) REFERENCES `course_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_orders_package_group_id'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_package_group_id` FOREIGN KEY (`package_group_id`) REFERENCES `package_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_payment_records_package_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD CONSTRAINT `fk_payment_records_package_id` FOREIGN KEY (`package_id`) REFERENCES `course_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'payment_records'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_payment_records_package_group_id'
  ),
  'SELECT 1',
  'ALTER TABLE `payment_records` ADD CONSTRAINT `fk_payment_records_package_group_id` FOREIGN KEY (`package_group_id`) REFERENCES `package_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
