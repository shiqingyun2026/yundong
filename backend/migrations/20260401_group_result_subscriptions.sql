create table if not exists public.group_result_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  scene text not null default 'group_result',
  template_key text not null default 'groupResult',
  template_id text not null default '',
  decision text not null default 'unknown',
  status text not null default 'unsubscribed',
  reason text not null default '',
  raw_result jsonb,
  requested_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists group_result_subscriptions_user_group_template_unique_idx
  on public.group_result_subscriptions (user_id, group_id, template_key);

create index if not exists group_result_subscriptions_group_id_idx
  on public.group_result_subscriptions (group_id);

create index if not exists group_result_subscriptions_course_id_idx
  on public.group_result_subscriptions (course_id);
