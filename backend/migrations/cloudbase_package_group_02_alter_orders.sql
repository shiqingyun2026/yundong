-- 课包拼团 V2.2 CloudBase 控制台执行 02：扩展 orders 表
-- 建议一条一条执行。遇到 Duplicate column，表示该列已经存在，跳过继续下一条。

ALTER TABLE `orders` MODIFY COLUMN `course_id` VARCHAR(36) NULL;

ALTER TABLE `orders` MODIFY COLUMN `group_id` VARCHAR(36) NULL;

ALTER TABLE `orders` ADD COLUMN `order_type` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `user_id`;

ALTER TABLE `orders` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`;

ALTER TABLE `orders` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`;

ALTER TABLE `orders` ADD COLUMN `package_action` VARCHAR(10) NULL AFTER `package_group_id`;

ALTER TABLE `orders` ADD COLUMN `package_context` TEXT NULL AFTER `package_action`;

ALTER TABLE `orders` ADD KEY `idx_orders_order_type_status_created_at` (`order_type`, `status`, `created_at`);

ALTER TABLE `orders` ADD KEY `idx_orders_package_status_created_at` (`package_id`, `status`, `created_at`);

ALTER TABLE `orders` ADD KEY `idx_orders_package_group_status_created_at` (`package_group_id`, `status`, `created_at`);
