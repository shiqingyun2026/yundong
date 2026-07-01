USE `tiyubao-pre`;

CREATE TABLE IF NOT EXISTS `course_package_locations` (
  `id` VARCHAR(64) NOT NULL,
  `package_id` VARCHAR(64) NOT NULL,
  `location_district` VARCHAR(255) NOT NULL DEFAULT '',
  `location_community` VARCHAR(255) NOT NULL DEFAULT '',
  `location_detail` VARCHAR(500) NOT NULL DEFAULT '',
  `longitude` DECIMAL(10,6) DEFAULT NULL,
  `latitude` DECIMAL(10,6) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_package_locations_package_id` (`package_id`),
  KEY `idx_course_package_locations_status` (`status`),
  KEY `idx_course_package_locations_package_status` (`package_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `package_groups`
  ADD COLUMN `location_id` VARCHAR(64) DEFAULT NULL AFTER `package_id`,
  ADD COLUMN `location_snapshot` JSON DEFAULT NULL AFTER `location_id`;

INSERT INTO `course_package_locations` (
  `id`, `package_id`, `location_district`, `location_community`, `location_detail`,
  `longitude`, `latitude`, `sort_order`, `status`, `created_at`, `updated_at`
)
SELECT
  CONCAT(`id`, '-loc-001'),
  `id`,
  COALESCE(`location_district`, ''),
  COALESCE(`location_community`, ''),
  COALESCE(`location_detail`, ''),
  `longitude`,
  `latitude`,
  0,
  1,
  COALESCE(`created_at`, NOW()),
  COALESCE(`updated_at`, NOW())
FROM `course_packages` p
WHERE NOT EXISTS (
  SELECT 1 FROM `course_package_locations` l WHERE l.`package_id` = p.`id`
);
