alter table course_packages
  add column wechat_share_cover varchar(1024) not null default '' after cover;
