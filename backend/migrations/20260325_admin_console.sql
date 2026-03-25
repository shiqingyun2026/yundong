-- 邻动体适能运营后台数据库迁移
-- 执行日期：2026-03-25
-- 说明：
-- 1. 为运营后台补充管理员表、审计表，以及课程/订单后台所需字段。
-- 2. 本迁移以向后兼容为前提，不删除现有小程序字段。

begin;

create table if not exists public.admin_users (
  id uuid primary key,
  email varchar(100) unique not null,
  username varchar(50) not null unique,
  password_hash text,
  role varchar(20) not null default 'admin',
  status varchar(20) not null default 'active',
  last_login timestamptz,
  password_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_role_check check (role in ('super_admin', 'admin')),
  constraint admin_users_status_check check (status in ('active', 'disabled'))
);

create index if not exists idx_admin_users_role on public.admin_users(role);
create index if not exists idx_admin_users_status on public.admin_users(status);

create table if not exists public.admin_log (
  id bigserial primary key,
  admin_id uuid not null references public.admin_users(id),
  action varchar(50) not null,
  target_type varchar(50),
  target_id varchar(100),
  detail jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_log_admin_id on public.admin_log(admin_id);
create index if not exists idx_admin_log_action on public.admin_log(action);
create index if not exists idx_admin_log_created_at on public.admin_log(created_at desc);

alter table public.courses
  add column if not exists end_time timestamptz,
  add column if not exists deadline timestamptz,
  add column if not exists location_district varchar(100),
  add column if not exists location_community varchar(100),
  add column if not exists location_detail varchar(255),
  add column if not exists longitude numeric(10, 6),
  add column if not exists latitude numeric(10, 6),
  add column if not exists default_target_count integer,
  add column if not exists status smallint,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_by uuid references public.admin_users(id),
  add column if not exists updated_by uuid references public.admin_users(id);

alter table public.orders
  add column if not exists order_no varchar(32),
  add column if not exists pay_time timestamptz,
  add column if not exists refund_time timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refund_operator_id uuid references public.admin_users(id),
  add column if not exists transaction_id varchar(64),
  add column if not exists updated_at timestamptz default now();

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'success', 'refunded', 'closed'));

update public.orders
set order_no = 'LD' || to_char(created_at at time zone 'UTC', 'YYYYMMDDHH24MISS') || substr(md5(id::text), 1, 6)
where order_no is null;

update public.orders
set pay_time = created_at
where status = 'success' and pay_time is null;

update public.courses
set status = case
  when status is not null then status
  when start_time is null then 0
  when start_time > now() then 0
  else 1
end
where status is null;

commit;
