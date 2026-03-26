-- 课程状态机与上下架时间字段
-- 执行日期：2026-03-26

begin;

alter table public.courses
  add column if not exists publish_time timestamptz,
  add column if not exists unpublish_time timestamptz;

update public.courses
set publish_time = coalesce(publish_time, created_at, now() + interval '1 day')
where publish_time is null;

commit;
