DELETE FROM `payment_records` WHERE `id` IN ('pay_test_001', 'pay_test_002');
DELETE FROM `orders` WHERE `id` IN ('order_test_001', 'order_test_002');
DELETE FROM `package_groups` WHERE `id` IN ('pg_test_001');
DELETE FROM `course_packages` WHERE `id` IN ('pkg_test_001', 'pkg_test_002', 'pkg_test_003');
DELETE FROM `mini_program_banners` WHERE `id` IN ('banner_test_001', 'banner_test_002');
DELETE FROM `user_identities` WHERE `id` IN ('identity_test_u01', 'identity_test_u02');
DELETE FROM `users` WHERE `id` IN ('user_test_001', 'user_test_002');

INSERT INTO `users` (`id`, `openid`, `nickname`, `avatar_url`, `phone`, `created_at`, `updated_at`) VALUES
('user_test_001', 'seed_test_openid_001', '测试家长A', 'https://dummyimage.com/120x120/e8f8f9/1abcc5.png&text=A', '13800000001', '2026-06-01 10:00:00', '2026-06-01 10:00:00'),
('user_test_002', 'seed_test_openid_002', '测试家长B', 'https://dummyimage.com/120x120/fbead9/ff7a00.png&text=B', '13800000002', '2026-06-01 10:05:00', '2026-06-01 10:05:00');

INSERT INTO `user_identities` (`id`, `user_id`, `identity_type`, `identity_key`, `created_at`, `updated_at`, `last_used_at`) VALUES
('identity_test_u01', 'user_test_001', 'wechat_openid', 'seed_test_openid_001', '2026-06-01 10:00:00', '2026-06-01 10:00:00', '2026-06-01 10:00:00'),
('identity_test_u02', 'user_test_002', 'wechat_openid', 'seed_test_openid_002', '2026-06-01 10:05:00', '2026-06-01 10:05:00', '2026-06-01 10:05:00');

INSERT INTO `mini_program_banners` (`id`, `image_url`, `title`, `jump_type`, `jump_target`, `sort`, `online_time`, `offline_time`, `status`, `created_at`, `updated_at`) VALUES
('banner_test_001', 'https://dummyimage.com/1200x420/f6ead3/b9832f.png&text=PACKAGE+HOME', '首页主Banner', 'none', '', 10, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'online', '2026-06-01 10:10:00', '2026-06-01 10:10:00'),
('banner_test_002', 'https://dummyimage.com/1200x420/e7f8ef/1f9d63.png&text=TRIAL+PACKAGE', '体验课Banner', 'none', '', 20, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'online', '2026-06-01 10:11:00', '2026-06-01 10:11:00');

INSERT INTO `course_packages` (
  `id`, `name`, `cover`, `wechat_share_cover`, `images`, `total_price`, `package_category`, `age_range`, `class_count`,
  `class_duration_minutes`, `show_limited_time_offer_tag`, `supported_people`, `group_price_config`,
  `location_district`, `location_community`, `location_detail`, `longitude`, `latitude`, `coach_name`, `coach_intro`,
  `coach_certificates`, `description`, `deadline_hours`, `publish_time`, `unpublish_time`, `status`,
  `created_at`, `updated_at`, `created_by`, `updated_by`
) VALUES
('pkg_test_001', '[测试] 少儿体适能 体验课', 'https://dummyimage.com/960x540/e8f1ff/235784.png&text=Trial+Package', 'https://dummyimage.com/960x540/d9ecff/235784.png&text=Share+Cover', '["https://dummyimage.com/1280x720/e8f1ff/235784.png&text=Trial+01","https://dummyimage.com/1280x720/d9ecff/235784.png&text=Trial+02"]', 9900, '体验课', '4-6岁', 1, 60, 1, '2,3,4', '[{"target_count":2,"price_fen":4900},{"target_count":3,"price_fen":3900},{"target_count":4,"price_fen":3500}]', '南山区', '桃源社区', '邻动体适能训练点', 113.9654321, 22.5421357, '王教练', '专注少儿体适能与动作启蒙。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+A"]', '<p>用于测试环境的体验课详情内容。</p>', 48, '2026-01-01 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:20:00', '2026-06-01 10:20:00', 'seed', 'seed'),
('pkg_test_002', '[测试] 少儿跳绳基础课', 'https://dummyimage.com/960x540/fff4d8/c79200.png&text=Jump+Rope', '', '["https://dummyimage.com/1280x720/fff4d8/c79200.png&text=Jump+01"]', 19900, '跳绳', '5-8岁', 4, 60, 0, '2,4', '[{"target_count":2,"price_fen":9900},{"target_count":4,"price_fen":5900}]', '福田区', '香蜜湖社区', '香蜜体育公园', 114.0401123, 22.5412234, '李教练', '专注跳绳基础动作与节奏训练。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+B"]', '<p>用于测试环境的跳绳课详情内容。</p>', 72, '2026-01-05 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:21:00', '2026-06-01 10:21:00', 'seed', 'seed'),
('pkg_test_003', '[测试] 少儿体适能进阶课', 'https://dummyimage.com/960x540/e7f8ef/1f9d63.png&text=Fitness+Advanced', '', '["https://dummyimage.com/1280x720/e7f8ef/1f9d63.png&text=Fitness+01"]', 29900, '体适能', '6-9岁', 6, 75, 1, '3,5', '[{"target_count":3,"price_fen":10900},{"target_count":5,"price_fen":7900}]', '宝安区', '新安社区', '宝安青少年活动中心', 113.8834567, 22.5556789, '陈教练', '进阶体能与团队协作训练。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+C"]', '<p>用于测试环境的进阶课详情内容。</p>', 96, '2026-01-10 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:22:00', '2026-06-01 10:22:00', 'seed', 'seed');

INSERT INTO `package_groups` (
  `id`, `package_id`, `creator_id`, `target_count`, `current_count`, `status`, `weekday`, `hour`,
  `first_class_time`, `schedule_config`, `deadline`, `created_at`, `success_time`
) VALUES
('pg_test_001', 'pkg_test_001', 'user_test_001', 4, 2, 'active', 6, 10, '2026-06-15 10:00:00', '{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]}', '2027-12-31 23:59:59', '2026-06-01 11:00:00', NULL);

INSERT INTO `orders` (
  `id`, `order_no`, `user_id`, `order_type`, `course_id`, `group_id`, `package_id`, `package_group_id`,
  `package_action`, `package_context`, `amount`, `status`, `created_at`, `updated_at`,
  `pay_time`, `refund_time`, `refund_reason`, `refund_operator_id`, `transaction_id`
) VALUES
('order_test_001', 'LDPKG-20260601-000001', 'user_test_001', 2, NULL, NULL, 'pkg_test_001', 'pg_test_001', 'start', '{"target_count":4,"weekday":6,"hour":10,"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}],"schedule_config":{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]},"child_nickname":"小满","child_age":6,"parent_mobile":"13800138000"}', 4900, 'paid', '2026-06-01 11:10:00', '2026-06-01 11:10:00', '2026-06-01 11:10:00', NULL, '', NULL, 'tx_test_001'),
('order_test_002', 'LDPKG-20260601-000002', 'user_test_002', 2, NULL, NULL, 'pkg_test_001', 'pg_test_001', 'join', '{"target_count":4,"weekday":6,"hour":10,"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}],"schedule_config":{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]},"child_nickname":"乐乐","child_age":5,"parent_mobile":"13800138001"}', 4900, 'paid', '2026-06-01 11:15:00', '2026-06-01 11:15:00', '2026-06-01 11:15:00', NULL, '', NULL, 'tx_test_002');

INSERT INTO `payment_records` (
  `id`, `order_id`, `user_id`, `course_id`, `group_id`, `package_id`, `package_group_id`,
  `provider`, `channel`, `payment_mode`, `out_trade_no`, `transaction_id`, `amount`,
  `status`, `callback_status`, `prepare_payload`, `callback_payload`,
  `paid_at`, `closed_at`, `created_at`, `updated_at`
) VALUES
('pay_test_001', 'order_test_001', 'user_test_001', NULL, NULL, 'pkg_test_001', 'pg_test_001', 'wechat', 'mini_program', 'mock', 'LDPKG-20260601-000001', 'tx_test_001', 4900, 'paid', 'success', '{"mode":"mock"}', '{"status":"success"}', '2026-06-01 11:10:00', NULL, '2026-06-01 11:10:00', '2026-06-01 11:10:00'),
('pay_test_002', 'order_test_002', 'user_test_002', NULL, NULL, 'pkg_test_001', 'pg_test_001', 'wechat', 'mini_program', 'mock', 'LDPKG-20260601-000002', 'tx_test_002', 4900, 'paid', 'success', '{"mode":"mock"}', '{"status":"success"}', '2026-06-01 11:15:00', NULL, '2026-06-01 11:15:00', '2026-06-01 11:15:00');

INSERT INTO `biz_serial_counters` (`biz_type`, `biz_date`, `current_seq`, `created_at`, `updated_at`) VALUES
('PKG', '20260601', 3, '2026-06-01 12:00:00', '2026-06-01 12:00:00'),
('PG', '20260601', 1, '2026-06-01 12:00:00', '2026-06-01 12:00:00'),
('LDPKG', '20260601', 2, '2026-06-01 12:00:00', '2026-06-01 12:00:00');
