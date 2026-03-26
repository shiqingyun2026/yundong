-- 邻动体适能测试数据重置 SQL
-- 用途：
-- 1. 清理 2026-03-26 这批课程/拼团/订单/用户测试数据
-- 2. 重新导入一套固定可回归的数据
--
-- 覆盖口径：
-- - 待上架
-- - 拼团中
-- - 等待上课
-- - 拼团失败（含系统自动退款，保留 group_members）
-- - 已结课
--
-- 使用方式：
-- - 直接在 Supabase SQL Editor 执行整段 SQL
-- - 建议已先执行：
--   - backend/migrations/20260325_admin_console.sql
--   - backend/migrations/20260326_course_lifecycle.sql

begin;

-- 先删掉旧的日志，避免列表里残留历史测试痕迹
delete from public.admin_log
where target_id in (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '21111111-1111-1111-1111-111111111201',
  '21111111-1111-1111-1111-111111111202',
  '21111111-1111-1111-1111-111111111203',
  '21111111-1111-1111-1111-111111111204',
  '31111111-1111-1111-1111-111111111301',
  '31111111-1111-1111-1111-111111111302',
  '31111111-1111-1111-1111-111111111303',
  '31111111-1111-1111-1111-111111111304',
  '31111111-1111-1111-1111-111111111305',
  '31111111-1111-1111-1111-111111111306',
  '31111111-1111-1111-1111-111111111307',
  '31111111-1111-1111-1111-111111111308',
  '31111111-1111-1111-1111-111111111309',
  '31111111-1111-1111-1111-111111111310',
  '31111111-1111-1111-1111-111111111311',
  '31111111-1111-1111-1111-111111111312'
);

-- 清理旧测试数据。这里同时按固定 UUID 和测试命名双保险删除。
delete from public.group_members
where group_id in (
  select id
  from public.groups
  where id in (
    '21111111-1111-1111-1111-111111111201',
    '21111111-1111-1111-1111-111111111202',
    '21111111-1111-1111-1111-111111111203',
    '21111111-1111-1111-1111-111111111204'
  )
     or course_id in (
       select id
       from public.courses
       where id in (
         '11111111-1111-1111-1111-111111111101',
         '11111111-1111-1111-1111-111111111102',
         '11111111-1111-1111-1111-111111111103',
         '11111111-1111-1111-1111-111111111104',
         '11111111-1111-1111-1111-111111111105'
       )
          or name in (
            '[测试] 深圳南山周末体适能·待上架',
            '[测试] 深圳福田少儿体适能·拼团中',
            '[测试] 深圳宝安体能进阶·等待上课',
            '[测试] 深圳龙华平衡训练·拼团失败',
            '[测试] 深圳罗湖爆发力训练·已结课'
          )
     )
);

delete from public.orders
where id in (
  '31111111-1111-1111-1111-111111111301',
  '31111111-1111-1111-1111-111111111302',
  '31111111-1111-1111-1111-111111111303',
  '31111111-1111-1111-1111-111111111304',
  '31111111-1111-1111-1111-111111111305',
  '31111111-1111-1111-1111-111111111306',
  '31111111-1111-1111-1111-111111111307',
  '31111111-1111-1111-1111-111111111308',
  '31111111-1111-1111-1111-111111111309',
  '31111111-1111-1111-1111-111111111310',
  '31111111-1111-1111-1111-111111111311',
  '31111111-1111-1111-1111-111111111312'
)
   or course_id in (
     select id
     from public.courses
     where id in (
       '11111111-1111-1111-1111-111111111101',
       '11111111-1111-1111-1111-111111111102',
       '11111111-1111-1111-1111-111111111103',
       '11111111-1111-1111-1111-111111111104',
       '11111111-1111-1111-1111-111111111105'
     )
        or name in (
          '[测试] 深圳南山周末体适能·待上架',
          '[测试] 深圳福田少儿体适能·拼团中',
          '[测试] 深圳宝安体能进阶·等待上课',
          '[测试] 深圳龙华平衡训练·拼团失败',
          '[测试] 深圳罗湖爆发力训练·已结课'
        )
   )
   or user_id in (
     select id
     from public.users
     where openid like 'seed0326_u%'
   );

delete from public.groups
where id in (
  '21111111-1111-1111-1111-111111111201',
  '21111111-1111-1111-1111-111111111202',
  '21111111-1111-1111-1111-111111111203',
  '21111111-1111-1111-1111-111111111204'
)
   or course_id in (
     select id
     from public.courses
     where id in (
       '11111111-1111-1111-1111-111111111101',
       '11111111-1111-1111-1111-111111111102',
       '11111111-1111-1111-1111-111111111103',
       '11111111-1111-1111-1111-111111111104',
       '11111111-1111-1111-1111-111111111105'
     )
        or name in (
          '[测试] 深圳南山周末体适能·待上架',
          '[测试] 深圳福田少儿体适能·拼团中',
          '[测试] 深圳宝安体能进阶·等待上课',
          '[测试] 深圳龙华平衡训练·拼团失败',
          '[测试] 深圳罗湖爆发力训练·已结课'
        )
   );

delete from public.courses
where id in (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105'
)
   or name in (
     '[测试] 深圳南山周末体适能·待上架',
     '[测试] 深圳福田少儿体适能·拼团中',
     '[测试] 深圳宝安体能进阶·等待上课',
     '[测试] 深圳龙华平衡训练·拼团失败',
     '[测试] 深圳罗湖爆发力训练·已结课'
   );

delete from public.users
where id in (
  '41111111-1111-1111-1111-111111111401',
  '41111111-1111-1111-1111-111111111402',
  '41111111-1111-1111-1111-111111111403',
  '41111111-1111-1111-1111-111111111404',
  '41111111-1111-1111-1111-111111111405',
  '41111111-1111-1111-1111-111111111406'
)
   or openid like 'seed0326_u%';

-- 6 个测试用户
insert into public.users (
  id,
  openid,
  nickname,
  avatar_url,
  created_at
) values
  (
    '41111111-1111-1111-1111-111111111401',
    'seed0326_u01',
    '测试家长01',
    'https://dummyimage.com/120x120/ffd6a5/6b3f1d.png&text=U01',
    now() - interval '15 day'
  ),
  (
    '41111111-1111-1111-1111-111111111402',
    'seed0326_u02',
    '测试家长02',
    'https://dummyimage.com/120x120/caffbf/245b3b.png&text=U02',
    now() - interval '14 day'
  ),
  (
    '41111111-1111-1111-1111-111111111403',
    'seed0326_u03',
    '测试家长03',
    'https://dummyimage.com/120x120/9bf6ff/1e5162.png&text=U03',
    now() - interval '13 day'
  ),
  (
    '41111111-1111-1111-1111-111111111404',
    'seed0326_u04',
    '测试家长04',
    'https://dummyimage.com/120x120/bdb2ff/3f2a74.png&text=U04',
    now() - interval '12 day'
  ),
  (
    '41111111-1111-1111-1111-111111111405',
    'seed0326_u05',
    '测试家长05',
    'https://dummyimage.com/120x120/ffafcc/742d48.png&text=U05',
    now() - interval '11 day'
  ),
  (
    '41111111-1111-1111-1111-111111111406',
    'seed0326_u06',
    '测试家长06',
    'https://dummyimage.com/120x120/a0c4ff/24456b.png&text=U06',
    now() - interval '10 day'
  );

-- 5 门测试课程
insert into public.courses (
  id,
  name,
  cover,
  images,
  address,
  location_district,
  location_community,
  location_detail,
  longitude,
  latitude,
  start_time,
  end_time,
  publish_time,
  unpublish_time,
  deadline,
  group_price,
  original_price,
  default_target_count,
  max_groups,
  age_limit,
  coach_name,
  coach_intro,
  coach_certificates,
  insurance_desc,
  service_qr_code,
  description,
  status,
  created_at,
  updated_at
) values
  (
    '11111111-1111-1111-1111-111111111101',
    '[测试] 深圳南山周末体适能·待上架',
    'https://dummyimage.com/960x540/e8f1ff/235784.png&text=%E5%BE%85%E4%B8%8A%E6%9E%B6',
    '["https://dummyimage.com/1280x720/e8f1ff/235784.png&text=Pending+01","https://dummyimage.com/1280x720/d9ecff/235784.png&text=Pending+02"]'::jsonb,
    '深圳市南山区桃源街道邻动体适能训练点',
    '南山区',
    '桃源社区',
    '桃源街道邻动体适能训练点 A 场',
    113.950100,
    22.562100,
    now() + interval '10 day',
    now() + interval '10 day 2 hour',
    now() + interval '2 day',
    null,
    now() + interval '9 day',
    99.00,
    168.00,
    3,
    2,
    '5-8岁',
    '李教练',
    '用于验证待上架课程不出现在用户端列表。',
    '["https://dummyimage.com/480x320/e8f1ff/235784.png&text=Coach+Pending"]'::jsonb,
    '测试课程默认赠送运动意外险。',
    'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    '<p>待上架课程，用于验证课程状态机与用户端过滤。</p>',
    0,
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    '[测试] 深圳福田少儿体适能·拼团中',
    'https://dummyimage.com/960x540/fff1d6/8a5310.png&text=%E6%8B%BC%E5%9B%A2%E4%B8%AD',
    '["https://dummyimage.com/1280x720/fff1d6/8a5310.png&text=Grouping+01","https://dummyimage.com/1280x720/ffe7c2/8a5310.png&text=Grouping+02"]'::jsonb,
    '深圳市福田区香蜜湖社区运动中心',
    '福田区',
    '香蜜湖社区',
    '香蜜湖社区运动中心 2 楼',
    114.041500,
    22.541600,
    now() + interval '7 day',
    now() + interval '7 day 2 hour',
    now() - interval '3 day',
    null,
    now() + interval '2 day',
    129.00,
    199.00,
    3,
    3,
    '4-7岁',
    '周教练',
    '用于验证拼团中课程、活跃团、待支付订单和已支付成员并存。',
    '["https://dummyimage.com/480x320/fff1d6/8a5310.png&text=Coach+Grouping"]'::jsonb,
    '测试课程默认赠送运动意外险。',
    'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    '<p>拼团中课程，用于验证首页列表、课程详情和活跃团展示。</p>',
    1,
    now() - interval '6 day',
    now() - interval '1 hour'
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    '[测试] 深圳宝安体能进阶·等待上课',
    'https://dummyimage.com/960x540/e2f7e1/2f6b2f.png&text=%E7%AD%89%E5%BE%85%E4%B8%8A%E8%AF%BE',
    '["https://dummyimage.com/1280x720/e2f7e1/2f6b2f.png&text=Waiting+01","https://dummyimage.com/1280x720/d1f0cf/2f6b2f.png&text=Waiting+02"]'::jsonb,
    '深圳市宝安区新安街道体能训练馆',
    '宝安区',
    '新安社区',
    '新安街道体能训练馆 1 楼',
    113.884700,
    22.555300,
    now() + interval '3 day',
    now() + interval '3 day 2 hour',
    now() - interval '6 day',
    null,
    now() - interval '1 day',
    139.00,
    219.00,
    3,
    3,
    '6-9岁',
    '陈教练',
    '用于验证成功团但课程尚未开课时展示等待上课。',
    '["https://dummyimage.com/480x320/e2f7e1/2f6b2f.png&text=Coach+Waiting"]'::jsonb,
    '测试课程默认赠送运动意外险。',
    'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    '<p>等待上课课程，用于验证成功团在我的拼团里显示等待上课。</p>',
    3,
    now() - interval '8 day',
    now() - interval '30 minute'
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    '[测试] 深圳龙华平衡训练·拼团失败',
    'https://dummyimage.com/960x540/ffe3e3/8a1c1c.png&text=%E6%8B%BC%E5%9B%A2%E5%A4%B1%E8%B4%A5',
    '["https://dummyimage.com/1280x720/ffe3e3/8a1c1c.png&text=Failed+01","https://dummyimage.com/1280x720/ffd0d0/8a1c1c.png&text=Failed+02"]'::jsonb,
    '深圳市龙华区民治街道平衡训练空间',
    '龙华区',
    '民治社区',
    '民治街道平衡训练空间 B 区',
    114.043900,
    22.621700,
    now() + interval '4 day',
    now() + interval '4 day 2 hour',
    now() - interval '8 day',
    null,
    now() - interval '1 day',
    119.00,
    189.00,
    3,
    2,
    '5-8岁',
    '黄教练',
    '用于验证失败团自动退款口径，以及保留历史成员记录。',
    '["https://dummyimage.com/480x320/ffe3e3/8a1c1c.png&text=Coach+Failed"]'::jsonb,
    '测试课程默认赠送运动意外险。',
    'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    '<p>拼团失败课程，用于验证退款与 group_members 保留逻辑。</p>',
    2,
    now() - interval '10 day',
    now() - interval '20 minute'
  ),
  (
    '11111111-1111-1111-1111-111111111105',
    '[测试] 深圳罗湖爆发力训练·已结课',
    'https://dummyimage.com/960x540/e9e3ff/4b2e83.png&text=%E5%B7%B2%E7%BB%93%E8%AF%BE',
    '["https://dummyimage.com/1280x720/e9e3ff/4b2e83.png&text=Finished+01","https://dummyimage.com/1280x720/dcd1ff/4b2e83.png&text=Finished+02"]'::jsonb,
    '深圳市罗湖区翠竹街道爆发力训练场',
    '罗湖区',
    '翠竹社区',
    '翠竹街道爆发力训练场主馆',
    114.129200,
    22.553900,
    now() - interval '3 day',
    now() - interval '2 day 22 hour',
    now() - interval '15 day',
    null,
    now() - interval '10 day',
    159.00,
    239.00,
    4,
    4,
    '7-10岁',
    '吴教练',
    '用于验证成功团且课程结课后的展示口径。',
    '["https://dummyimage.com/480x320/e9e3ff/4b2e83.png&text=Coach+Finished"]'::jsonb,
    '测试课程默认赠送运动意外险。',
    'https://dummyimage.com/240x240/f3f8ff/1677ff.png&text=%E5%AE%A2%E6%9C%8D',
    '<p>已结课课程，用于验证成功团在我的拼团里显示已结课。</p>',
    5,
    now() - interval '20 day',
    now() - interval '10 minute'
  );

-- 4 个拼团
insert into public.groups (
  id,
  course_id,
  creator_id,
  status,
  current_count,
  target_count,
  expire_time,
  created_at
) values
  (
    '21111111-1111-1111-1111-111111111201',
    '11111111-1111-1111-1111-111111111102',
    '41111111-1111-1111-1111-111111111401',
    'active',
    2,
    3,
    now() + interval '2 day',
    now() - interval '2 day'
  ),
  (
    '21111111-1111-1111-1111-111111111202',
    '11111111-1111-1111-1111-111111111103',
    '41111111-1111-1111-1111-111111111402',
    'success',
    3,
    3,
    now() - interval '1 day',
    now() - interval '5 day'
  ),
  (
    '21111111-1111-1111-1111-111111111203',
    '11111111-1111-1111-1111-111111111104',
    '41111111-1111-1111-1111-111111111403',
    'failed',
    2,
    3,
    now() - interval '1 day',
    now() - interval '4 day'
  ),
  (
    '21111111-1111-1111-1111-111111111204',
    '11111111-1111-1111-1111-111111111105',
    '41111111-1111-1111-1111-111111111404',
    'success',
    4,
    4,
    now() - interval '10 day',
    now() - interval '12 day'
  );

-- 支付成功后才入团。失败团保留历史 group_members。
insert into public.group_members (
  group_id,
  user_id,
  joined_at
) values
  ('21111111-1111-1111-1111-111111111201', '41111111-1111-1111-1111-111111111401', now() - interval '2 day' + interval '10 minute'),
  ('21111111-1111-1111-1111-111111111201', '41111111-1111-1111-1111-111111111402', now() - interval '2 day' + interval '25 minute'),
  ('21111111-1111-1111-1111-111111111202', '41111111-1111-1111-1111-111111111402', now() - interval '5 day' + interval '15 minute'),
  ('21111111-1111-1111-1111-111111111202', '41111111-1111-1111-1111-111111111403', now() - interval '5 day' + interval '22 minute'),
  ('21111111-1111-1111-1111-111111111202', '41111111-1111-1111-1111-111111111404', now() - interval '5 day' + interval '30 minute'),
  ('21111111-1111-1111-1111-111111111203', '41111111-1111-1111-1111-111111111403', now() - interval '4 day' + interval '12 minute'),
  ('21111111-1111-1111-1111-111111111203', '41111111-1111-1111-1111-111111111404', now() - interval '4 day' + interval '40 minute'),
  ('21111111-1111-1111-1111-111111111204', '41111111-1111-1111-1111-111111111401', now() - interval '12 day' + interval '5 minute'),
  ('21111111-1111-1111-1111-111111111204', '41111111-1111-1111-1111-111111111402', now() - interval '12 day' + interval '12 minute'),
  ('21111111-1111-1111-1111-111111111204', '41111111-1111-1111-1111-111111111405', now() - interval '12 day' + interval '18 minute'),
  ('21111111-1111-1111-1111-111111111204', '41111111-1111-1111-1111-111111111406', now() - interval '12 day' + interval '28 minute');

-- 12 笔订单：
-- - 拼团中课程：2 success + 1 pending
-- - 等待上课课程：3 success
-- - 拼团失败课程：2 refunded
-- - 已结课课程：4 success
insert into public.orders (
  id,
  user_id,
  course_id,
  group_id,
  amount,
  status,
  order_no,
  pay_time,
  refund_time,
  refund_reason,
  transaction_id,
  created_at,
  updated_at
) values
  (
    '31111111-1111-1111-1111-111111111301',
    '41111111-1111-1111-1111-111111111401',
    '11111111-1111-1111-1111-111111111102',
    '21111111-1111-1111-1111-111111111201',
    129.00,
    'success',
    'LD202603260001',
    now() - interval '2 day' + interval '10 minute',
    null,
    null,
    'TXN202603260001',
    now() - interval '2 day',
    now() - interval '2 day' + interval '10 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111302',
    '41111111-1111-1111-1111-111111111402',
    '11111111-1111-1111-1111-111111111102',
    '21111111-1111-1111-1111-111111111201',
    129.00,
    'success',
    'LD202603260002',
    now() - interval '2 day' + interval '25 minute',
    null,
    null,
    'TXN202603260002',
    now() - interval '2 day' + interval '5 minute',
    now() - interval '2 day' + interval '25 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111303',
    '41111111-1111-1111-1111-111111111403',
    '11111111-1111-1111-1111-111111111102',
    '21111111-1111-1111-1111-111111111201',
    129.00,
    'pending',
    'LD202603260003',
    null,
    null,
    null,
    null,
    now() - interval '1 day' + interval '2 hour',
    now() - interval '1 day' + interval '2 hour'
  ),
  (
    '31111111-1111-1111-1111-111111111304',
    '41111111-1111-1111-1111-111111111402',
    '11111111-1111-1111-1111-111111111103',
    '21111111-1111-1111-1111-111111111202',
    139.00,
    'success',
    'LD202603260004',
    now() - interval '5 day' + interval '15 minute',
    null,
    null,
    'TXN202603260004',
    now() - interval '5 day',
    now() - interval '5 day' + interval '15 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111305',
    '41111111-1111-1111-1111-111111111403',
    '11111111-1111-1111-1111-111111111103',
    '21111111-1111-1111-1111-111111111202',
    139.00,
    'success',
    'LD202603260005',
    now() - interval '5 day' + interval '22 minute',
    null,
    null,
    'TXN202603260005',
    now() - interval '5 day' + interval '3 minute',
    now() - interval '5 day' + interval '22 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111306',
    '41111111-1111-1111-1111-111111111404',
    '11111111-1111-1111-1111-111111111103',
    '21111111-1111-1111-1111-111111111202',
    139.00,
    'success',
    'LD202603260006',
    now() - interval '5 day' + interval '30 minute',
    null,
    null,
    'TXN202603260006',
    now() - interval '5 day' + interval '6 minute',
    now() - interval '5 day' + interval '30 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111307',
    '41111111-1111-1111-1111-111111111403',
    '11111111-1111-1111-1111-111111111104',
    '21111111-1111-1111-1111-111111111203',
    119.00,
    'refunded',
    'LD202603260007',
    now() - interval '4 day' + interval '12 minute',
    now() - interval '1 day' + interval '5 minute',
    '报名截止前未成团，系统自动退款',
    'TXN202603260007',
    now() - interval '4 day',
    now() - interval '1 day' + interval '5 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111308',
    '41111111-1111-1111-1111-111111111404',
    '11111111-1111-1111-1111-111111111104',
    '21111111-1111-1111-1111-111111111203',
    119.00,
    'refunded',
    'LD202603260008',
    now() - interval '4 day' + interval '40 minute',
    now() - interval '1 day' + interval '5 minute',
    '报名截止前未成团，系统自动退款',
    'TXN202603260008',
    now() - interval '4 day' + interval '8 minute',
    now() - interval '1 day' + interval '5 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111309',
    '41111111-1111-1111-1111-111111111401',
    '11111111-1111-1111-1111-111111111105',
    '21111111-1111-1111-1111-111111111204',
    159.00,
    'success',
    'LD202603260009',
    now() - interval '12 day' + interval '5 minute',
    null,
    null,
    'TXN202603260009',
    now() - interval '12 day',
    now() - interval '12 day' + interval '5 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111310',
    '41111111-1111-1111-1111-111111111402',
    '11111111-1111-1111-1111-111111111105',
    '21111111-1111-1111-1111-111111111204',
    159.00,
    'success',
    'LD202603260010',
    now() - interval '12 day' + interval '12 minute',
    null,
    null,
    'TXN202603260010',
    now() - interval '12 day' + interval '2 minute',
    now() - interval '12 day' + interval '12 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111311',
    '41111111-1111-1111-1111-111111111405',
    '11111111-1111-1111-1111-111111111105',
    '21111111-1111-1111-1111-111111111204',
    159.00,
    'success',
    'LD202603260011',
    now() - interval '12 day' + interval '18 minute',
    null,
    null,
    'TXN202603260011',
    now() - interval '12 day' + interval '4 minute',
    now() - interval '12 day' + interval '18 minute'
  ),
  (
    '31111111-1111-1111-1111-111111111312',
    '41111111-1111-1111-1111-111111111406',
    '11111111-1111-1111-1111-111111111105',
    '21111111-1111-1111-1111-111111111204',
    159.00,
    'success',
    'LD202603260012',
    now() - interval '12 day' + interval '28 minute',
    null,
    null,
    'TXN202603260012',
    now() - interval '12 day' + interval '6 minute',
    now() - interval '12 day' + interval '28 minute'
  );

commit;

-- 可选校验 1：确认 5 门测试课程都已回写
select id, name, status, publish_time, deadline, start_time, end_time
from public.courses
where name in (
  '[测试] 深圳南山周末体适能·待上架',
  '[测试] 深圳福田少儿体适能·拼团中',
  '[测试] 深圳宝安体能进阶·等待上课',
  '[测试] 深圳龙华平衡训练·拼团失败',
  '[测试] 深圳罗湖爆发力训练·已结课'
)
order by name;

-- 可选校验 2：确认团与订单数量
select course_id, status, count(*) as group_count
from public.groups
where course_id in (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105'
)
group by course_id, status
order by course_id, status;

select course_id, status, count(*) as order_count
from public.orders
where course_id in (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105'
)
group by course_id, status
order by course_id, status;
