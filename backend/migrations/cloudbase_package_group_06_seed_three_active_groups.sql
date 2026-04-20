-- 课包拼团 V2.2 CloudBase 控制台执行 06：同一课包下预置 3 个进行中团
-- 用途：验证首页 activeGroupCount=3、课包详情页同时展示多个进行中团。
-- 执行前提：
-- 1. 已执行 cloudbase_package_group_01_create_tables.sql
-- 2. 已执行 cloudbase_package_group_05_seed_home_packages.sql
-- 3. 如已执行 07，可保持 package_home_seed_002 的 package_category=体适能

DELETE FROM `package_groups`
WHERE `id` IN (
  'pkg_group_home_seed_001',
  'pkg_group_home_seed_002',
  'pkg_group_home_seed_003'
);

INSERT INTO `package_groups` (
  `id`,
  `package_id`,
  `creator_id`,
  `target_count`,
  `current_count`,
  `status`,
  `weekday`,
  `hour`,
  `first_class_time`,
  `deadline`,
  `created_at`,
  `success_time`
) VALUES
  (
    'pkg_group_home_seed_001',
    'package_home_seed_002',
    NULL,
    4,
    1,
    'active',
    6,
    10,
    NULL,
    DATE_ADD(NOW(), INTERVAL 30 HOUR),
    DATE_SUB(NOW(), INTERVAL 6 HOUR),
    NULL
  ),
  (
    'pkg_group_home_seed_002',
    'package_home_seed_002',
    NULL,
    4,
    2,
    'active',
    7,
    15,
    NULL,
    DATE_ADD(NOW(), INTERVAL 36 HOUR),
    DATE_SUB(NOW(), INTERVAL 5 HOUR),
    NULL
  ),
  (
    'pkg_group_home_seed_003',
    'package_home_seed_002',
    NULL,
    6,
    3,
    'active',
    3,
    19,
    NULL,
    DATE_ADD(NOW(), INTERVAL 42 HOUR),
    DATE_SUB(NOW(), INTERVAL 4 HOUR),
    NULL
  );

SELECT
  `package_id`,
  COUNT(*) AS `active_group_count`,
  GROUP_CONCAT(CONCAT(`id`, ':', `current_count`, '/', `target_count`) ORDER BY `created_at` SEPARATOR ' | ') AS `active_groups`
FROM `package_groups`
WHERE `package_id` = 'package_home_seed_002'
  AND `status` = 'active'
GROUP BY `package_id`;
