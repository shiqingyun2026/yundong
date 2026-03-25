-- 邻动体适能运营后台管理员密码字段补充迁移
-- 执行日期：2026-03-25

begin;

alter table public.admin_users
  add column if not exists password_hash text,
  add column if not exists password_updated_at timestamptz;

commit;
