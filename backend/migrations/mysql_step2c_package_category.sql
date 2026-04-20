-- 课包拼团 V2.2 增量迁移：补充课包类型字段
-- 用途：支持后台新建课包时必选“体适能 / 跳绳”，并驱动小程序首页分类筛选

ALTER TABLE `course_packages`
  ADD COLUMN `package_category` VARCHAR(20) NOT NULL DEFAULT '体适能' AFTER `total_price`;

UPDATE `course_packages`
SET `package_category` = '体适能'
WHERE `package_category` IS NULL
   OR TRIM(`package_category`) = '';
