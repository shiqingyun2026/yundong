START TRANSACTION;

CREATE TABLE IF NOT EXISTS biz_serial_counters (
  biz_type VARCHAR(32) NOT NULL COMMENT '业务类型：PKG / PG / LDPKG',
  biz_date VARCHAR(8) NOT NULL COMMENT '业务日期，格式 YYYYMMDD',
  current_seq INT NOT NULL DEFAULT 0 COMMENT '当前已分配流水号',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (biz_type, biz_date),
  KEY idx_biz_serial_counters_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课包/拼团/课包订单按日流水计数器';

ALTER TABLE course_packages
  MODIFY COLUMN id VARCHAR(64) NOT NULL COMMENT '课包编号，兼容历史 UUID 与新格式 PKG-YYYYMMDD-####';

ALTER TABLE package_groups
  MODIFY COLUMN id VARCHAR(64) NOT NULL COMMENT '拼团编号，兼容历史 UUID 与新格式 PG-YYYYMMDD-#####',
  MODIFY COLUMN package_id VARCHAR(64) NOT NULL;

ALTER TABLE orders
  MODIFY COLUMN order_no VARCHAR(32) NULL COMMENT '课包订单号，格式 LDPKG-YYYYMMDD-######',
  MODIFY COLUMN package_id VARCHAR(64) NULL,
  MODIFY COLUMN package_group_id VARCHAR(64) NULL;

ALTER TABLE payment_records
  MODIFY COLUMN package_id VARCHAR(64) NULL,
  MODIFY COLUMN package_group_id VARCHAR(64) NULL;

COMMIT;
