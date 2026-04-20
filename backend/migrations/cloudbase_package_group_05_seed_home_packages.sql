-- 课包拼团 V2.2 CloudBase 控制台执行 05：最小首页课包种子
-- 用途：先验证小程序首页 /api/packages 能读到课包。
-- 直接全选执行即可。

DELETE FROM `package_groups`
WHERE `id` IN (
  'pkg_group_home_seed_001'
)
   OR `package_id` IN (
     'package_home_seed_001',
     'package_home_seed_002'
   );

DELETE FROM `course_packages`
WHERE `id` IN (
  'package_home_seed_001',
  'package_home_seed_002'
);

INSERT INTO `course_packages` (
  `id`,
  `name`,
  `cover`,
  `images`,
  `total_price`,
  `package_category`,
  `supported_people`,
  `location_district`,
  `location_community`,
  `location_detail`,
  `longitude`,
  `latitude`,
  `coach_name`,
  `coach_intro`,
  `coach_certificates`,
  `description`,
  `deadline_hours`,
  `status`,
  `created_at`,
  `updated_at`,
  `created_by`,
  `updated_by`
) VALUES
  (
    'package_home_seed_001',
    '[真机验证] 周末体适能 5 次课',
    'https://dummyimage.com/960x540/e8f4ff/21598a.png&text=Package+Home+01',
    '[]',
    159900,
    '体适能',
    '2,4,6',
    '南山区',
    '科技园社区',
    '科技园邻动训练点 A 场',
    113.9512000,
    22.5431000,
    '课包教练 A',
    '用于真机验证首页课包列表。',
    '[]',
    '<p>用于验证课包首页、详情页和立即开团入口。</p>',
    48,
    1,
    NOW(),
    NOW(),
    NULL,
    NULL
  ),
  (
    'package_home_seed_002',
    '[真机验证] 进行中少儿体适能 5 次课',
    'https://dummyimage.com/960x540/fff3de/8a5a12.png&text=Package+Home+02',
    '[]',
    198000,
    '体适能',
    '2,4,6,8',
    '福田区',
    '香蜜社区',
    '香蜜公园邻动训练区 2 号草坪',
    114.0417000,
    22.5498000,
    '课包教练 B',
    '用于真机验证进行中拼团入口。',
    '[]',
    '<p>用于验证首页“进行中拼团”和课包详情页团列表。</p>',
    48,
    1,
    NOW(),
    NOW(),
    NULL,
    NULL
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
) VALUES (
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
  NOW(),
  NULL
);

SELECT `id`, `name`, `status`
FROM `course_packages`
WHERE `id` IN ('package_home_seed_001', 'package_home_seed_002')
ORDER BY `created_at` DESC;
