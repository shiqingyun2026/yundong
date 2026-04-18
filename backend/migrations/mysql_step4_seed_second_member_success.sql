INSERT INTO users (
  id,
  openid,
  nickname,
  avatar_url,
  created_at,
  updated_at
) VALUES (
  'user_release_seed_002',
  'seed_release_u02',
  '联调用户B',
  '',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  nickname = '联调用户B',
  updated_at = NOW();

INSERT INTO orders (
  id,
  order_no,
  user_id,
  course_id,
  group_id,
  amount,
  status,
  created_at,
  updated_at,
  pay_time,
  refund_time,
  refund_reason,
  refund_operator_id,
  transaction_id
)
SELECT
  'order_release_seed_002',
  'LD202604180002',
  'user_release_seed_002',
  g.course_id,
  g.id,
  88,
  'success',
  NOW(),
  NOW(),
  NOW(),
  NULL,
  NULL,
  NULL,
  ''
FROM `groups` g
WHERE g.course_id = 'course_release_seed_001'
  AND g.status = 'active'
LIMIT 1
ON DUPLICATE KEY UPDATE
  status = 'success',
  updated_at = NOW(),
  pay_time = NOW();

INSERT IGNORE INTO group_members (
  group_id,
  user_id,
  joined_at
)
SELECT
  g.id,
  'user_release_seed_002',
  NOW()
FROM `groups` g
WHERE g.course_id = 'course_release_seed_001'
  AND g.status = 'active'
LIMIT 1;

INSERT INTO payment_records (
  id,
  order_id,
  user_id,
  course_id,
  group_id,
  provider,
  channel,
  payment_mode,
  out_trade_no,
  transaction_id,
  amount,
  status,
  callback_status,
  prepare_payload,
  callback_payload,
  paid_at,
  closed_at,
  created_at,
  updated_at
)
SELECT
  'pay_release_seed_002',
  'order_release_seed_002',
  'user_release_seed_002',
  g.course_id,
  g.id,
  'wechat',
  'mini_program',
  'mock',
  'LD202604180002',
  '',
  88,
  'paid',
  'mock_success',
  '{}',
  '{}',
  NOW(),
  NULL,
  NOW(),
  NOW()
FROM `groups` g
WHERE g.course_id = 'course_release_seed_001'
  AND g.status = 'active'
LIMIT 1
ON DUPLICATE KEY UPDATE
  status = 'paid',
  callback_status = 'mock_success',
  paid_at = NOW(),
  updated_at = NOW();

UPDATE `groups`
SET
  current_count = CASE
    WHEN target_count IS NULL OR target_count <= 0 THEN current_count + 1
    ELSE target_count
  END,
  status = 'success',
  success_time = NOW()
WHERE course_id = 'course_release_seed_001'
  AND status = 'active';
