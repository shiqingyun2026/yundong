START TRANSACTION;

ALTER TABLE package_groups
  ADD COLUMN IF NOT EXISTS schedule_config JSON NULL COMMENT '课包拼团正式排课配置：single/daily/weekly + schedule_days + schedule_list' AFTER first_class_time;

ALTER TABLE orders
  MODIFY COLUMN package_context JSON NULL COMMENT '课包订单快照：孩子信息、成团人数、正式排课配置与完整课表';

COMMIT;

-- 说明：
-- 1. schedule_config 为 package_groups 的正式排课字段，weekday/hour 保留为兼容冗余字段。
-- 2. orders.package_context 建议至少保存：
--    target_count / child_nickname / child_age / parent_mobile /
--    schedule_type / schedule_date / schedule_time / schedule_days / class_count / schedule_list /
--    schedule_config
-- 3. 迁移后新读链路应优先读取 schedule_config，只有历史数据缺失时才回退 weekday/hour/first_class_time。
