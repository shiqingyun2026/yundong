-- 课包拼团 V2.2 CloudBase 控制台执行 03：扩展 payment_records 表
-- 建议一条一条执行。遇到 Duplicate column/index，表示已经存在，跳过继续下一条。

ALTER TABLE `payment_records` MODIFY COLUMN `course_id` VARCHAR(36) NULL;

ALTER TABLE `payment_records` MODIFY COLUMN `group_id` VARCHAR(36) NULL;

ALTER TABLE `payment_records` ADD COLUMN `package_id` VARCHAR(36) NULL AFTER `group_id`;

ALTER TABLE `payment_records` ADD COLUMN `package_group_id` VARCHAR(36) NULL AFTER `package_id`;

ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_id` (`package_id`);

ALTER TABLE `payment_records` ADD KEY `idx_payment_records_package_group_id` (`package_group_id`);
