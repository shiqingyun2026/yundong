-- Package group flexible success threshold migration
-- Default test database: tiyubao-pre
-- Execute manually in Tencent Cloud DMS after confirming the target environment and database.

USE `tiyubao-pre`;

-- 1. Precheck: confirm whether the field already exists.
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'package_groups'
  AND COLUMN_NAME = 'min_success_count';

-- 2. Migration: add the minimum success threshold to historical and future package groups.
ALTER TABLE `package_groups`
  ADD COLUMN `min_success_count` INT NOT NULL DEFAULT 0 AFTER `target_count`;

UPDATE `package_groups`
SET `min_success_count` = `target_count`
WHERE `min_success_count` = 0;

-- 3. Postcheck: all rows should have 1 <= min_success_count <= target_count.
SELECT
  COUNT(*) AS invalid_group_count
FROM `package_groups`
WHERE `min_success_count` <= 0
   OR `min_success_count` > `target_count`;

SELECT
  `id`,
  `package_id`,
  `status`,
  `current_count`,
  `min_success_count`,
  `target_count`,
  `deadline`
FROM `package_groups`
ORDER BY `created_at` DESC
LIMIT 20;
