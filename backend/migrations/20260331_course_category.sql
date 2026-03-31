-- 课程类别字段补充迁移
-- 执行日期：2026-03-31

begin;

alter table public.courses
  add column if not exists course_category varchar(20);

update public.courses
set course_category = '体适能'
where course_category is null or btrim(course_category) = '';

alter table public.courses
  alter column course_category set default '体适能';

alter table public.courses
  alter column course_category set not null;

alter table public.courses
  drop constraint if exists courses_course_category_check;

alter table public.courses
  add constraint courses_course_category_check
  check (course_category in ('体适能', '跳绳'));

create index if not exists idx_courses_course_category on public.courses(course_category);

commit;
