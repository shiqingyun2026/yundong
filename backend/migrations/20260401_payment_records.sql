create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  provider text not null default 'wechat',
  channel text not null default 'mini_program',
  payment_mode text not null default 'mock',
  out_trade_no text not null,
  transaction_id text not null default '',
  amount integer not null default 0,
  status text not null default 'pending',
  callback_status text not null default '',
  prepare_payload jsonb,
  callback_payload jsonb,
  paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists payment_records_order_id_unique_idx
  on public.payment_records (order_id);

create unique index if not exists payment_records_out_trade_no_unique_idx
  on public.payment_records (out_trade_no);

create index if not exists payment_records_status_idx
  on public.payment_records (status);
