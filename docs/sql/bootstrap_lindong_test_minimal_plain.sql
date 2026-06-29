SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  openid VARCHAR(128) NOT NULL,
  nickname VARCHAR(128) NOT NULL DEFAULT '',
  avatar_url TEXT NULL,
  phone VARCHAR(32) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_openid (openid),
  KEY idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_identities (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  identity_type VARCHAR(64) NOT NULL,
  identity_key VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_used_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_identities_type_key (identity_type, identity_key),
  KEY idx_user_identities_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mini_program_banners (
  id VARCHAR(64) NOT NULL,
  image_url TEXT NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  jump_type VARCHAR(32) NOT NULL DEFAULT 'none',
  jump_target VARCHAR(255) NOT NULL DEFAULT '',
  sort INT NOT NULL DEFAULT 0,
  online_time DATETIME NULL,
  offline_time DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'online',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_mini_program_banners_sort (sort),
  KEY idx_mini_program_banners_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_packages (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  cover TEXT NULL,
  wechat_share_cover TEXT NULL,
  images LONGTEXT NULL,
  total_price INT NOT NULL DEFAULT 0,
  package_category VARCHAR(32) NOT NULL DEFAULT '体适能',
  age_range VARCHAR(64) NOT NULL DEFAULT '',
  class_count INT NOT NULL DEFAULT 0,
  class_duration_minutes INT NOT NULL DEFAULT 0,
  show_limited_time_offer_tag TINYINT(1) NOT NULL DEFAULT 0,
  supported_people VARCHAR(255) NOT NULL DEFAULT '',
  group_price_config LONGTEXT NULL,
  location_district VARCHAR(64) NOT NULL DEFAULT '',
  location_community VARCHAR(128) NOT NULL DEFAULT '',
  location_detail VARCHAR(255) NOT NULL DEFAULT '',
  longitude DECIMAL(10,7) NULL,
  latitude DECIMAL(10,7) NULL,
  coach_name VARCHAR(128) NOT NULL DEFAULT '',
  coach_intro TEXT NULL,
  coach_certificates LONGTEXT NULL,
  description MEDIUMTEXT NULL,
  deadline_hours INT NOT NULL DEFAULT 48,
  publish_time DATETIME NULL,
  unpublish_time DATETIME NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(64) NULL,
  updated_by VARCHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_course_packages_status (status),
  KEY idx_course_packages_publish_time (publish_time),
  KEY idx_course_packages_category (package_category),
  KEY idx_course_packages_location_district (location_district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS package_groups (
  id VARCHAR(64) NOT NULL,
  package_id VARCHAR(64) NOT NULL,
  creator_id VARCHAR(64) NULL,
  target_count INT NOT NULL DEFAULT 0,
  min_success_count INT NOT NULL DEFAULT 0,
  current_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  weekday INT NOT NULL DEFAULT 0,
  hour INT NOT NULL DEFAULT 0,
  first_class_time DATETIME NULL,
  schedule_config JSON NULL,
  deadline DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  success_time DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_package_groups_package_id (package_id),
  KEY idx_package_groups_status (status),
  KEY idx_package_groups_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  order_type INT NOT NULL DEFAULT 2,
  course_id VARCHAR(64) NULL,
  group_id VARCHAR(64) NULL,
  package_id VARCHAR(64) NULL,
  package_group_id VARCHAR(64) NULL,
  package_action VARCHAR(32) NULL,
  package_context LONGTEXT NULL,
  amount INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  pay_time DATETIME NULL,
  refund_time DATETIME NULL,
  refund_reason VARCHAR(255) NOT NULL DEFAULT '',
  refund_operator_id VARCHAR(64) NULL,
  transaction_id VARCHAR(128) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uk_orders_order_no (order_no),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_package_id (package_id),
  KEY idx_orders_package_group_id (package_group_id),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_records (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NULL,
  group_id VARCHAR(64) NULL,
  package_id VARCHAR(64) NULL,
  package_group_id VARCHAR(64) NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'wechat',
  channel VARCHAR(32) NOT NULL DEFAULT 'mini_program',
  payment_mode VARCHAR(32) NOT NULL DEFAULT 'mock',
  out_trade_no VARCHAR(64) NOT NULL,
  transaction_id VARCHAR(128) NOT NULL DEFAULT '',
  amount INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  callback_status VARCHAR(32) NOT NULL DEFAULT '',
  prepare_payload LONGTEXT NULL,
  callback_payload LONGTEXT NULL,
  paid_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_records_order_id (order_id),
  UNIQUE KEY uk_payment_records_out_trade_no (out_trade_no),
  KEY idx_payment_records_user_id (user_id),
  KEY idx_payment_records_package_group_id (package_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS biz_serial_counters (
  biz_type VARCHAR(32) NOT NULL,
  biz_date VARCHAR(8) NOT NULL,
  current_seq INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (biz_type, biz_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELETE FROM payment_records WHERE id IN ('pay_test_001', 'pay_test_002');
DELETE FROM orders WHERE id IN ('order_test_001', 'order_test_002');
DELETE FROM package_groups WHERE id IN ('pg_test_001');
DELETE FROM course_packages WHERE id IN ('pkg_test_001', 'pkg_test_002', 'pkg_test_003');
DELETE FROM mini_program_banners WHERE id IN ('banner_test_001', 'banner_test_002');
DELETE FROM user_identities WHERE id IN ('identity_test_u01', 'identity_test_u02');
DELETE FROM users WHERE id IN ('user_test_001', 'user_test_002');

INSERT INTO users (id, openid, nickname, avatar_url, phone, created_at, updated_at) VALUES
('user_test_001', 'seed_test_openid_001', '测试家长A', 'https://dummyimage.com/120x120/e8f8f9/1abcc5.png&text=A', '13800000001', '2026-06-01 10:00:00', '2026-06-01 10:00:00'),
('user_test_002', 'seed_test_openid_002', '测试家长B', 'https://dummyimage.com/120x120/fbead9/ff7a00.png&text=B', '13800000002', '2026-06-01 10:05:00', '2026-06-01 10:05:00');

INSERT INTO user_identities (id, user_id, identity_type, identity_key, created_at, updated_at, last_used_at) VALUES
('identity_test_u01', 'user_test_001', 'wechat_openid', 'seed_test_openid_001', '2026-06-01 10:00:00', '2026-06-01 10:00:00', '2026-06-01 10:00:00'),
('identity_test_u02', 'user_test_002', 'wechat_openid', 'seed_test_openid_002', '2026-06-01 10:05:00', '2026-06-01 10:05:00', '2026-06-01 10:05:00');

INSERT INTO mini_program_banners (id, image_url, title, jump_type, jump_target, sort, online_time, offline_time, status, created_at, updated_at) VALUES
('banner_test_001', 'https://dummyimage.com/1200x420/f6ead3/b9832f.png&text=PACKAGE+HOME', '首页主Banner', 'none', '', 10, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'online', '2026-06-01 10:10:00', '2026-06-01 10:10:00'),
('banner_test_002', 'https://dummyimage.com/1200x420/e7f8ef/1f9d63.png&text=TRIAL+PACKAGE', '体验课Banner', 'none', '', 20, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'online', '2026-06-01 10:11:00', '2026-06-01 10:11:00');

INSERT INTO course_packages (
  id, name, cover, wechat_share_cover, images, total_price, package_category, age_range, class_count,
  class_duration_minutes, show_limited_time_offer_tag, supported_people, group_price_config,
  location_district, location_community, location_detail, longitude, latitude, coach_name, coach_intro,
  coach_certificates, description, deadline_hours, publish_time, unpublish_time, status,
  created_at, updated_at, created_by, updated_by
) VALUES
('pkg_test_001', '[测试] 少儿体适能 体验课', 'https://dummyimage.com/960x540/e8f1ff/235784.png&text=Trial+Package', 'https://dummyimage.com/960x540/d9ecff/235784.png&text=Share+Cover', '["https://dummyimage.com/1280x720/e8f1ff/235784.png&text=Trial+01","https://dummyimage.com/1280x720/d9ecff/235784.png&text=Trial+02"]', 9900, '体验课', '4-6岁', 1, 60, 1, '2,3,4', '[{"target_count":2,"price_fen":4900},{"target_count":3,"price_fen":3900},{"target_count":4,"price_fen":3500}]', '南山区', '桃源社区', '邻动体适能训练点', 113.9654321, 22.5421357, '王教练', '专注少儿体适能与动作启蒙。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+A"]', '<p>用于测试环境的体验课详情内容。</p>', 48, '2026-01-01 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:20:00', '2026-06-01 10:20:00', 'seed', 'seed'),
('pkg_test_002', '[测试] 少儿跳绳基础课', 'https://dummyimage.com/960x540/fff4d8/c79200.png&text=Jump+Rope', '', '["https://dummyimage.com/1280x720/fff4d8/c79200.png&text=Jump+01"]', 19900, '跳绳', '5-8岁', 4, 60, 0, '2,4', '[{"target_count":2,"price_fen":9900},{"target_count":4,"price_fen":5900}]', '福田区', '香蜜湖社区', '香蜜体育公园', 114.0401123, 22.5412234, '李教练', '专注跳绳基础动作与节奏训练。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+B"]', '<p>用于测试环境的跳绳课详情内容。</p>', 72, '2026-01-05 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:21:00', '2026-06-01 10:21:00', 'seed', 'seed'),
('pkg_test_003', '[测试] 少儿体适能进阶课', 'https://dummyimage.com/960x540/e7f8ef/1f9d63.png&text=Fitness+Advanced', '', '["https://dummyimage.com/1280x720/e7f8ef/1f9d63.png&text=Fitness+01"]', 29900, '体适能', '6-9岁', 6, 75, 1, '3,5', '[{"target_count":3,"price_fen":10900},{"target_count":5,"price_fen":7900}]', '宝安区', '新安社区', '宝安青少年活动中心', 113.8834567, 22.5556789, '陈教练', '进阶体能与团队协作训练。', '["https://dummyimage.com/800x1200/f3f4f6/374151.png&text=Coach+Cert+C"]', '<p>用于测试环境的进阶课详情内容。</p>', 96, '2026-01-10 10:00:00', '2027-12-31 23:59:59', 1, '2026-06-01 10:22:00', '2026-06-01 10:22:00', 'seed', 'seed');

INSERT INTO package_groups (
  id, package_id, creator_id, target_count, min_success_count, current_count, status, weekday, hour,
  first_class_time, schedule_config, deadline, created_at, success_time
) VALUES
('pg_test_001', 'pkg_test_001', 'user_test_001', 4, 4, 2, 'active', 6, 10, '2026-06-15 10:00:00', '{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]}', '2027-12-31 23:59:59', '2026-06-01 11:00:00', NULL);

INSERT INTO orders (
  id, order_no, user_id, order_type, course_id, group_id, package_id, package_group_id,
  package_action, package_context, amount, status, created_at, updated_at,
  pay_time, refund_time, refund_reason, refund_operator_id, transaction_id
) VALUES
('order_test_001', 'LDPKG-20260601-000001', 'user_test_001', 2, NULL, NULL, 'pkg_test_001', 'pg_test_001', 'start', '{"target_count":4,"weekday":6,"hour":10,"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}],"schedule_config":{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]},"child_nickname":"小满","child_age":6,"parent_mobile":"13800138000"}', 4900, 'paid', '2026-06-01 11:10:00', '2026-06-01 11:10:00', '2026-06-01 11:10:00', NULL, '', NULL, 'tx_test_001'),
('order_test_002', 'LDPKG-20260601-000002', 'user_test_002', 2, NULL, NULL, 'pkg_test_001', 'pg_test_001', 'join', '{"target_count":4,"weekday":6,"hour":10,"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}],"schedule_config":{"schedule_type":"weekly","schedule_date":"2026-06-15","schedule_time":"10:00","schedule_days":[6],"class_count":1,"schedule_list":[{"index":1,"class_time":"2026-06-15 10:00:00","display_text":"2026-06-15 10:00:00"}]},"child_nickname":"乐乐","child_age":5,"parent_mobile":"13800138001"}', 4900, 'paid', '2026-06-01 11:15:00', '2026-06-01 11:15:00', '2026-06-01 11:15:00', NULL, '', NULL, 'tx_test_002');

INSERT INTO payment_records (
  id, order_id, user_id, course_id, group_id, package_id, package_group_id,
  provider, channel, payment_mode, out_trade_no, transaction_id, amount,
  status, callback_status, prepare_payload, callback_payload,
  paid_at, closed_at, created_at, updated_at
) VALUES
('pay_test_001', 'order_test_001', 'user_test_001', NULL, NULL, 'pkg_test_001', 'pg_test_001', 'wechat', 'mini_program', 'mock', 'LDPKG-20260601-000001', 'tx_test_001', 4900, 'paid', 'success', '{"mode":"mock"}', '{"status":"success"}', '2026-06-01 11:10:00', NULL, '2026-06-01 11:10:00', '2026-06-01 11:10:00'),
('pay_test_002', 'order_test_002', 'user_test_002', NULL, NULL, 'pkg_test_001', 'pg_test_001', 'wechat', 'mini_program', 'mock', 'LDPKG-20260601-000002', 'tx_test_002', 4900, 'paid', 'success', '{"mode":"mock"}', '{"status":"success"}', '2026-06-01 11:15:00', NULL, '2026-06-01 11:15:00', '2026-06-01 11:15:00');

INSERT INTO biz_serial_counters (biz_type, biz_date, current_seq, created_at, updated_at) VALUES
('PKG', '20260601', 3, '2026-06-01 12:00:00', '2026-06-01 12:00:00'),
('PG', '20260601', 1, '2026-06-01 12:00:00', '2026-06-01 12:00:00'),
('LDPKG', '20260601', 2, '2026-06-01 12:00:00', '2026-06-01 12:00:00')
ON DUPLICATE KEY UPDATE
current_seq = VALUES(current_seq),
updated_at = VALUES(updated_at);

SET FOREIGN_KEY_CHECKS = 1;
