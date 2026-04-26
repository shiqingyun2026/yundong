ALTER TABLE `course_packages`
  ADD COLUMN `age_range` VARCHAR(100) NOT NULL DEFAULT '' AFTER `package_category`,
  ADD COLUMN `class_count` INT NOT NULL DEFAULT 0 AFTER `age_range`,
  ADD COLUMN `class_duration_minutes` INT NOT NULL DEFAULT 0 AFTER `class_count`,
  ADD COLUMN `group_price_config` JSON NULL AFTER `supported_people`,
  ADD COLUMN `publish_time` DATETIME NULL AFTER `deadline_hours`,
  ADD COLUMN `unpublish_time` DATETIME NULL AFTER `publish_time`;
