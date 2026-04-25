CREATE TABLE IF NOT EXISTS `mini_program_banners` (
  `id` varchar(64) NOT NULL,
  `image_url` varchar(1024) NOT NULL DEFAULT '',
  `title` varchar(128) NOT NULL DEFAULT '',
  `jump_type` varchar(32) NOT NULL DEFAULT 'none',
  `jump_target` varchar(512) NOT NULL DEFAULT '',
  `sort` int NOT NULL DEFAULT 0,
  `online_time` datetime DEFAULT NULL,
  `offline_time` datetime DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mini_program_banners_status_sort` (`status`, `sort`),
  KEY `idx_mini_program_banners_online_time` (`online_time`),
  KEY `idx_mini_program_banners_offline_time` (`offline_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `mini_program_banners` (
  `id`,
  `image_url`,
  `title`,
  `jump_type`,
  `jump_target`,
  `sort`,
  `online_time`,
  `offline_time`,
  `status`,
  `created_at`,
  `updated_at`
) VALUES
  (
    'home-banner-fitness-spring',
    '',
    '体适能春季课程',
    'none',
    '',
    10,
    '2026-01-01 00:00:00',
    '2027-01-01 00:00:00',
    'active',
    '2026-04-22 00:00:00',
    '2026-04-22 00:00:00'
  ),
  (
    'home-banner-package-detail-demo',
    '',
    '连续 5 次训练计划',
    'packageDetail',
    'package-1',
    20,
    '2026-01-01 00:00:00',
    '2027-01-01 00:00:00',
    'active',
    '2026-04-22 00:00:00',
    '2026-04-22 00:00:00'
  ),
  (
    'home-banner-location-search',
    '',
    '按社区快速找课',
    'miniprogramPage',
    '/pages/location-search/index',
    30,
    '2026-01-01 00:00:00',
    '2027-01-01 00:00:00',
    'active',
    '2026-04-22 00:00:00',
    '2026-04-22 00:00:00'
  )
ON DUPLICATE KEY UPDATE
  `image_url` = VALUES(`image_url`),
  `title` = VALUES(`title`),
  `jump_type` = VALUES(`jump_type`),
  `jump_target` = VALUES(`jump_target`),
  `sort` = VALUES(`sort`),
  `online_time` = VALUES(`online_time`),
  `offline_time` = VALUES(`offline_time`),
  `status` = VALUES(`status`),
  `updated_at` = VALUES(`updated_at`);
