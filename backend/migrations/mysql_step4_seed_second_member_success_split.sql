INSERT IGNORE INTO users (
  id,
  openid,
  nickname,
  avatar_url,
  created_at,
  updated_at
) VALUES (
  'user_release_seed_002',
  'seed_release_u02',
  'seed_user_b',
  '',
  NOW(),
  NOW()
);

UPDATE users
SET nickname = 'seed_user_b',
    updated_at = NOW()
WHERE id = 'user_release_seed_002';

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
ORDER BY g.created_at DESC
LIMIT 1;

UPDATE `groups`
SET current_count = 2,
    status = 'success',
    success_time = NOW()
WHERE course_id = 'course_release_seed_001'
  AND status = 'active';
