CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL,
  email VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash TEXT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login DATETIME NULL,
  password_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_admin_users_email (email),
  UNIQUE KEY uniq_admin_users_username (username),
  KEY idx_admin_users_role (role),
  KEY idx_admin_users_status (status)
);

CREATE TABLE IF NOT EXISTS admin_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id VARCHAR(64) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(100) NULL,
  detail JSON NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_log_admin_id (admin_id),
  KEY idx_admin_log_action (action),
  KEY idx_admin_log_created_at (created_at)
);

INSERT INTO admin_users (
  id,
  email,
  username,
  password_hash,
  role,
  status,
  password_updated_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'admin@admin.local',
  'admin',
  'scrypt$38ca1d16479f171aa2db63af4d730e2f$c10932e3dafb2dbf94d9dbe265d1519e8afcb2e78ecca6f1cd6ecf2956746af01d864611fa4eff1dd6227696e2e78bbca7e9893eab7ff46fbb70366dafbb9224',
  'super_admin',
  'active',
  NOW()
)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  role = VALUES(role),
  status = VALUES(status);

SELECT id, username, role, status, created_at
FROM admin_users
ORDER BY created_at DESC;
