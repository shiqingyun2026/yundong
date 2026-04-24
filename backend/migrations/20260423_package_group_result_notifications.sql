ALTER TABLE `group_result_subscriptions`
  DROP FOREIGN KEY `fk_group_result_subscriptions_group_id`,
  DROP FOREIGN KEY `fk_group_result_subscriptions_course_id`;

ALTER TABLE `group_result_subscriptions`
  MODIFY COLUMN `template_key` VARCHAR(100) NOT NULL,
  ADD CONSTRAINT `fk_group_result_subscriptions_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `package_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_group_result_subscriptions_course_id`
    FOREIGN KEY (`course_id`) REFERENCES `course_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `group_result_notification_jobs`
  DROP FOREIGN KEY `fk_group_result_notification_jobs_group_id`,
  DROP FOREIGN KEY `fk_group_result_notification_jobs_course_id`;

ALTER TABLE `group_result_notification_jobs`
  ADD CONSTRAINT `fk_group_result_notification_jobs_group_id`
    FOREIGN KEY (`group_id`) REFERENCES `package_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_group_result_notification_jobs_course_id`
    FOREIGN KEY (`course_id`) REFERENCES `course_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
