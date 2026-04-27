SET @ddl = IF (
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'phone'
  ),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) NOT NULL DEFAULT '''''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `user_identities` (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  identity_type VARCHAR(32) NOT NULL,
  identity_key VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_identities_type_key (identity_type, identity_key),
  KEY idx_user_identities_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `user_identities` (
  id,
  user_id,
  identity_type,
  identity_key,
  created_at,
  updated_at,
  last_used_at
)
SELECT
  UUID(),
  u.id,
  'wechat_openid',
  u.openid,
  COALESCE(u.created_at, NOW()),
  COALESCE(u.updated_at, NOW()),
  COALESCE(u.updated_at, u.created_at, NOW())
FROM `users` u
WHERE COALESCE(u.openid, '') <> ''
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  updated_at = VALUES(updated_at),
  last_used_at = VALUES(last_used_at);

INSERT INTO `user_identities` (
  id,
  user_id,
  identity_type,
  identity_key,
  created_at,
  updated_at,
  last_used_at
)
SELECT
  UUID(),
  u.id,
  'phone',
  u.phone,
  COALESCE(u.created_at, NOW()),
  COALESCE(u.updated_at, NOW()),
  COALESCE(u.updated_at, u.created_at, NOW())
FROM `users` u
WHERE COALESCE(u.phone, '') <> ''
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  updated_at = VALUES(updated_at),
  last_used_at = VALUES(last_used_at);
