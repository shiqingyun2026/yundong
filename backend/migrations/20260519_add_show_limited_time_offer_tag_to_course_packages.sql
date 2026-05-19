ALTER TABLE `course_packages`
ADD COLUMN `show_limited_time_offer_tag` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否展示前台限时特惠标签' AFTER `class_duration_minutes`;
