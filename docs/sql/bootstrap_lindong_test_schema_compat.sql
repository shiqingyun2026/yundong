CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `openid` VARCHAR(128) NOT NULL,
  `nickname` VARCHAR(128) NOT NULL,
  `avatar_url` TEXT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `uk_users_openid` ON `users` (`openid`);
CREATE INDEX `idx_users_phone` ON `users` (`phone`);

CREATE TABLE IF NOT EXISTS `user_identities` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `identity_type` VARCHAR(64) NOT NULL,
  `identity_key` VARCHAR(191) NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `last_used_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `uk_user_identities_type_key` ON `user_identities` (`identity_type`, `identity_key`);
CREATE INDEX `idx_user_identities_user_id` ON `user_identities` (`user_id`);

CREATE TABLE IF NOT EXISTS `mini_program_banners` (
  `id` VARCHAR(64) NOT NULL,
  `image_url` TEXT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `jump_type` VARCHAR(32) NOT NULL,
  `jump_target` VARCHAR(255) NOT NULL,
  `sort` INT NOT NULL,
  `online_time` DATETIME NULL,
  `offline_time` DATETIME NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);

CREATE INDEX `idx_mini_program_banners_sort` ON `mini_program_banners` (`sort`);
CREATE INDEX `idx_mini_program_banners_status` ON `mini_program_banners` (`status`);

CREATE TABLE IF NOT EXISTS `course_packages` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `cover` TEXT NULL,
  `wechat_share_cover` TEXT NULL,
  `images` LONGTEXT NULL,
  `total_price` INT NOT NULL,
  `package_category` VARCHAR(32) NOT NULL,
  `age_range` VARCHAR(64) NOT NULL,
  `class_count` INT NOT NULL,
  `class_duration_minutes` INT NOT NULL,
  `show_limited_time_offer_tag` TINYINT(1) NOT NULL,
  `supported_people` VARCHAR(255) NOT NULL,
  `group_price_config` LONGTEXT NULL,
  `location_district` VARCHAR(64) NOT NULL,
  `location_community` VARCHAR(128) NOT NULL,
  `location_detail` VARCHAR(255) NOT NULL,
  `longitude` DECIMAL(10,7) NULL,
  `latitude` DECIMAL(10,7) NULL,
  `coach_name` VARCHAR(128) NOT NULL,
  `coach_intro` TEXT NULL,
  `coach_certificates` LONGTEXT NULL,
  `description` LONGTEXT NULL,
  `deadline_hours` INT NOT NULL,
  `publish_time` DATETIME NULL,
  `unpublish_time` DATETIME NULL,
  `status` TINYINT NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `created_by` VARCHAR(64) NULL,
  `updated_by` VARCHAR(64) NULL,
  PRIMARY KEY (`id`)
);

CREATE INDEX `idx_course_packages_status` ON `course_packages` (`status`);
CREATE INDEX `idx_course_packages_publish_time` ON `course_packages` (`publish_time`);
CREATE INDEX `idx_course_packages_category` ON `course_packages` (`package_category`);
CREATE INDEX `idx_course_packages_location_district` ON `course_packages` (`location_district`);

CREATE TABLE IF NOT EXISTS `package_groups` (
  `id` VARCHAR(64) NOT NULL,
  `package_id` VARCHAR(64) NOT NULL,
  `creator_id` VARCHAR(64) NULL,
  `target_count` INT NOT NULL,
  `min_success_count` INT NOT NULL,
  `current_count` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `weekday` INT NOT NULL,
  `hour` INT NOT NULL,
  `first_class_time` DATETIME NULL,
  `schedule_config` LONGTEXT NULL,
  `deadline` DATETIME NOT NULL,
  `created_at` DATETIME NULL,
  `success_time` DATETIME NULL,
  PRIMARY KEY (`id`)
);

CREATE INDEX `idx_package_groups_package_id` ON `package_groups` (`package_id`);
CREATE INDEX `idx_package_groups_status` ON `package_groups` (`status`);
CREATE INDEX `idx_package_groups_deadline` ON `package_groups` (`deadline`);

CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(64) NOT NULL,
  `order_no` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `order_type` INT NOT NULL,
  `course_id` VARCHAR(64) NULL,
  `group_id` VARCHAR(64) NULL,
  `package_id` VARCHAR(64) NULL,
  `package_group_id` VARCHAR(64) NULL,
  `package_action` VARCHAR(32) NULL,
  `package_context` LONGTEXT NULL,
  `amount` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `pay_time` DATETIME NULL,
  `refund_time` DATETIME NULL,
  `refund_reason` VARCHAR(255) NOT NULL,
  `refund_operator_id` VARCHAR(64) NULL,
  `transaction_id` VARCHAR(128) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `uk_orders_order_no` ON `orders` (`order_no`);
CREATE INDEX `idx_orders_user_id` ON `orders` (`user_id`);
CREATE INDEX `idx_orders_package_id` ON `orders` (`package_id`);
CREATE INDEX `idx_orders_package_group_id` ON `orders` (`package_group_id`);
CREATE INDEX `idx_orders_status` ON `orders` (`status`);

CREATE TABLE IF NOT EXISTS `payment_records` (
  `id` VARCHAR(64) NOT NULL,
  `order_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `course_id` VARCHAR(64) NULL,
  `group_id` VARCHAR(64) NULL,
  `package_id` VARCHAR(64) NULL,
  `package_group_id` VARCHAR(64) NULL,
  `provider` VARCHAR(32) NOT NULL,
  `channel` VARCHAR(32) NOT NULL,
  `payment_mode` VARCHAR(32) NOT NULL,
  `out_trade_no` VARCHAR(64) NOT NULL,
  `transaction_id` VARCHAR(128) NOT NULL,
  `amount` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `callback_status` VARCHAR(32) NOT NULL,
  `prepare_payload` LONGTEXT NULL,
  `callback_payload` LONGTEXT NULL,
  `paid_at` DATETIME NULL,
  `closed_at` DATETIME NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);

CREATE UNIQUE INDEX `uk_payment_records_order_id` ON `payment_records` (`order_id`);
CREATE UNIQUE INDEX `uk_payment_records_out_trade_no` ON `payment_records` (`out_trade_no`);
CREATE INDEX `idx_payment_records_user_id` ON `payment_records` (`user_id`);
CREATE INDEX `idx_payment_records_package_group_id` ON `payment_records` (`package_group_id`);

CREATE TABLE IF NOT EXISTS `biz_serial_counters` (
  `biz_type` VARCHAR(32) NOT NULL,
  `biz_date` VARCHAR(8) NOT NULL,
  `current_seq` INT NOT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`biz_type`, `biz_date`)
);
