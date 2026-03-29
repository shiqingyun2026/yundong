-- 每个用户同一课程只保留一笔 pending 订单
-- 执行日期：2026-03-29

begin;

with ranked_pending_orders as (
  select
    id,
    row_number() over (
      partition by user_id, course_id
      order by created_at desc nulls last, id desc
    ) as row_num
  from public.orders
  where status = 'pending'
)
update public.orders as orders
set
  status = 'closed',
  updated_at = now()
from ranked_pending_orders
where orders.id = ranked_pending_orders.id
  and ranked_pending_orders.row_num > 1;

create unique index if not exists orders_user_course_pending_unique_idx
  on public.orders (user_id, course_id)
  where status = 'pending';

commit;
