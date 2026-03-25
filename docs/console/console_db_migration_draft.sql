-- 邻动体适能运营后台数据库增量迁移草案
-- 生成日期：2026-03-25
-- 说明：
-- 1. 本文件为评审用草案，不代表已执行。
-- 2. 目标是为运营后台补齐管理员模型、审计能力与后台所需业务字段。
-- 3. 所有变更均采用增量方式，尽量不影响当前小程序链路。

begin;

-- =========================
-- 1. 管理员表
-- =========================

create table if not exists public.admin_users (
  id uuid primary key,
  email varchar(100) unique not null,
  username varchar(50) not null,
  role varchar(20) not null default 'admin',
  status varchar(20) not null default 'active',
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_role_check check (role in ('super_admin', 'admin')),
  constraint admin_users_status_check check (status in ('active', 'disabled'))
);

create index if not exists idx_admin_users_role on public.admin_users(role);
create index if not exists idx_admin_users_status on public.admin_users(status);

comment on table public.admin_users is '运营后台管理员表';
comment on column public.admin_users.id is '管理员ID，建议与认证用户ID对齐';
comment on column public.admin_users.email is '登录邮箱';
comment on column public.admin_users.username is '管理员显示名';
comment on column public.admin_users.role is '角色：super_admin/admin';
comment on column public.admin_users.status is '账号状态：active/disabled';

-- =========================
-- 2. 后台操作日志表
-- =========================

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

comment on table public.admin_log is '运营后台操作日志表';
comment on column public.admin_log.action is '操作类型，如 course_update/order_refund';
comment on column public.admin_log.target_type is '目标对象类型';
comment on column public.admin_log.target_id is '目标对象ID';

-- =========================
-- 3. 课程表扩展
-- =========================

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

comment on column public.courses.end_time is '上课结束时间';
comment on column public.courses.deadline is '报名截止时间';
comment on column public.courses.location_district is '区域';
comment on column public.courses.location_community is '小区名称';
comment on column public.courses.location_detail is '详细地点';
comment on column public.courses.longitude is '经度';
comment on column public.courses.latitude is '纬度';
comment on column public.courses.default_target_count is '课程默认成团人数';
comment on column public.courses.status is '课程状态：0待开始/1进行中/2已结束/3已下架';
comment on column public.courses.created_by is '后台创建人';
comment on column public.courses.updated_by is '后台更新人';

alter table public.courses
  drop constraint if exists courses_status_check;

alter table public.courses
  add constraint courses_status_check
  check (status is null or status in (0, 1, 2, 3));

create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_courses_deadline on public.courses(deadline);
create index if not exists idx_courses_start_time on public.courses(start_time);

-- =========================
-- 4. 订单表扩展
-- =========================

alter table public.orders
  add column if not exists order_no varchar(32),
  add column if not exists pay_time timestamptz,
  add column if not exists refund_time timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refund_operator_id uuid references public.admin_users(id),
  add column if not exists transaction_id varchar(64),
  add column if not exists updated_at timestamptz default now();

comment on column public.orders.order_no is '业务订单号';
comment on column public.orders.pay_time is '支付成功时间';
comment on column public.orders.refund_time is '退款时间';
comment on column public.orders.refund_reason is '退款原因';
comment on column public.orders.refund_operator_id is '退款操作管理员';
comment on column public.orders.transaction_id is '支付流水号';

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'success', 'refunded', 'closed'));

create unique index if not exists idx_orders_order_no on public.orders(order_no)
where order_no is not null;

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_course_id on public.orders(course_id);
create index if not exists idx_orders_group_id on public.orders(group_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- =========================
-- 5. 用户表可选扩展
-- =========================
-- 仅在产品重新确认需要手机号能力时启用
-- alter table public.users
--   add column if not exists phone varchar(20);
--
-- create index if not exists idx_users_phone on public.users(phone);

-- =========================
-- 6. 数据回填建议
-- =========================

-- 为已有订单生成业务订单号，格式可按实际规则调整
update public.orders
set order_no = 'LD' || to_char(created_at at time zone 'UTC', 'YYYYMMDDHH24MISS') || lpad(substr(md5(id::text), 1, 6), 6, '0')
where order_no is null;

-- 为已支付订单补写支付时间，临时回填为 created_at，后续可在真实支付接入后改为真实支付时间
update public.orders
set pay_time = created_at
where status = 'success' and pay_time is null;

-- 为课程状态做初始化，优先不覆盖未来由应用层动态计算的逻辑
update public.courses
set status = case
  when status is not null then status
  when start_time is null then 0
  when start_time > now() then 0
  else 1
end
where status is null;

commit;
