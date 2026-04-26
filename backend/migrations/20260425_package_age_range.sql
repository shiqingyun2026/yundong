ALTER TABLE `course_packages`
  ADD COLUMN `age_range` VARCHAR(100) NOT NULL DEFAULT '' AFTER `package_category`;

