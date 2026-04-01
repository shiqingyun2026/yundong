create table if not exists public.group_result_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  result_type text not null,
  template_id text not null default '',
  page_path text not null default '',
  status text not null default 'pending',
  message_snapshot jsonb not null default '{}'::jsonb,
  subscription_requested_at timestamptz,
  sent_at timestamptz,
  failure_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists group_result_notification_jobs_user_group_result_unique_idx
  on public.group_result_notification_jobs (user_id, group_id, result_type);

create index if not exists group_result_notification_jobs_status_idx
  on public.group_result_notification_jobs (status);

create index if not exists group_result_notification_jobs_group_id_idx
  on public.group_result_notification_jobs (group_id);
