-- 课包拼团 V2.2 CloudBase 控制台执行 04：检查结构

SHOW TABLES LIKE 'course_packages';

SHOW TABLES LIKE 'package_groups';

SHOW COLUMNS FROM `orders` LIKE 'order_type';

SHOW COLUMNS FROM `orders` LIKE 'package_id';

SHOW COLUMNS FROM `orders` LIKE 'package_group_id';

SHOW COLUMNS FROM `payment_records` LIKE 'package_id';

SHOW COLUMNS FROM `payment_records` LIKE 'package_group_id';
