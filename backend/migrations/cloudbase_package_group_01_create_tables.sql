-- 课包拼团 V2.2 CloudBase 控制台执行 01：创建课包表
-- 直接全选本文件执行，不要替换成省略号。

CREATE TABLE IF NOT EXISTS `course_packages` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `cover` VARCHAR(1024) DEFAULT NULL,
  `images` TEXT,
  `total_price` INT DEFAULT 0,
  `package_category` VARCHAR(20) NOT NULL DEFAULT '体适能',
  `age_range` VARCHAR(100) NOT NULL DEFAULT '',
  `supported_people` VARCHAR(32) DEFAULT NULL,
  `location_district` VARCHAR(50) DEFAULT NULL,
  `location_community` VARCHAR(50) DEFAULT NULL,
  `location_detail` VARCHAR(100) DEFAULT NULL,
  `longitude` DECIMAL(10,7) NULL,
  `latitude` DECIMAL(10,7) NULL,
  `coach_name` VARCHAR(50) DEFAULT NULL,
  `coach_intro` TEXT,
  `coach_certificates` TEXT,
  `description` MEDIUMTEXT,
  `deadline_hours` INT DEFAULT 48,
  `status` INT DEFAULT 0,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `created_by` VARCHAR(36) NULL,
  `updated_by` VARCHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_course_packages_status` (`status`),
  KEY `idx_course_packages_created_at` (`created_at`)
);

CREATE TABLE IF NOT EXISTS `package_groups` (
  `id` VARCHAR(36) NOT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `creator_id` VARCHAR(36) NULL,
  `target_count` INT DEFAULT 0,
  `current_count` INT DEFAULT 0,
  `status` VARCHAR(20) DEFAULT 'active',
  `weekday` TINYINT UNSIGNED NOT NULL,
  `hour` TINYINT UNSIGNED NOT NULL,
  `first_class_time` DATETIME NULL,
  `deadline` DATETIME NOT NULL,
  `created_at` DATETIME NULL,
  `success_time` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_package_groups_package_status_deadline` (`package_id`, `status`, `deadline`),
  KEY `idx_package_groups_creator_id` (`creator_id`),
  KEY `idx_package_groups_created_at` (`created_at`)
);
