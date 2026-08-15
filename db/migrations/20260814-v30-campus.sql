-- ============================================================
-- v30 · 校园活动 + 悬赏三分类扩展（2026-08-14）
-- 1) create_item_bounty 支持「提问(question)」类型（寻物/提问/代办跑腿三分类）
-- 2) campus_activities 校园活动表 + RLS + 列表 RPC + 种子数据
-- 幂等，可重复执行
-- ============================================================

-- ---------- 1. 悬赏类型扩展：支持 question ----------
CREATE OR REPLACE FUNCTION public.create_item_bounty(
  p_title text, p_content text, p_amount integer,
  p_type text DEFAULT 'item', p_campus_id integer DEFAULT NULL, p_contact text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_fee integer;
  v_bid integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_amount <= 0 OR p_amount > 200 THEN RAISE EXCEPTION '悬赏金额 1-200 元'; END IF;
  IF p_type NOT IN ('item', 'question', 'service', 'todo') THEN RAISE EXCEPTION '类型仅支持寻物/提问/代办跑腿'; END IF;
  v_fee := greatest(1, round(p_amount * 0.05));  -- 5% 服务费，最低 1 元
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < p_amount + v_fee THEN
    RAISE EXCEPTION '余额不足（悬赏 ¥% + 服务费 ¥% ）', p_amount, v_fee;
  END IF;
  UPDATE public.profiles SET balance = balance - p_amount - v_fee WHERE id = v_uid;
  INSERT INTO public.bounties(owner_id, title, content, total_amount, bounty_type, campus_id, contact)
  VALUES (v_uid, left(p_title, 30), p_content, p_amount, p_type, p_campus_id, coalesce(p_contact, ''))
  RETURNING id INTO v_bid;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -(p_amount + v_fee), (SELECT balance FROM public.profiles WHERE id = v_uid),
          '发布悬赏 #' || v_bid || '（' || p_type || '，含服务费 ¥' || v_fee || '）', 'bounty');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'bounty_item_create', jsonb_build_object('id', v_bid, 'type', p_type, 'fee', v_fee));
  RETURN jsonb_build_object('ok', true, 'bounty_id', v_bid, 'fee', v_fee);
END $$;

-- ---------- 2. 校园活动表 ----------
CREATE TABLE IF NOT EXISTS public.campus_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id integer NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_at timestamptz,
  end_at timestamptz,
  organizer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_school ON public.campus_activities(school_id, status);

ALTER TABLE public.campus_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ca_read" ON public.campus_activities;
CREATE POLICY "ca_read" ON public.campus_activities
  FOR SELECT TO authenticated USING (status = 'active');
DROP POLICY IF EXISTS "ca_read_anon" ON public.campus_activities;
CREATE POLICY "ca_read_anon" ON public.campus_activities
  FOR SELECT TO anon USING (status = 'active');

-- ---------- 3. 校园活动列表 RPC ----------
CREATE OR REPLACE FUNCTION public.list_campus_activities(p_school_id integer, p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'description', a.description, 'location', a.location,
    'start_at', a.start_at, 'end_at', a.end_at, 'organizer', a.organizer
  ) ORDER BY COALESCE(a.start_at, a.created_at) ASC), '[]')
  INTO v_rows
  FROM public.campus_activities a
  WHERE a.school_id = p_school_id AND a.status = 'active'
  LIMIT p_limit;
  RETURN v_rows;
END $$;

-- ---------- 4. 种子数据（按校名匹配插入，幂等） ----------
DO $$
DECLARE v_sid integer;
BEGIN
  FOR v_sid IN
    SELECT id FROM public.universities
    WHERE name IN ('清华大学', '北京大学', '复旦大学', '浙江大学', '武汉大学', '华中科技大学', '郑州大学', '南京大学', '上海交通大学', '西安交通大学')
  LOOP
    INSERT INTO public.campus_activities (school_id, title, description, location, start_at, end_at, organizer)
    VALUES
      (v_sid, '开学季·新生见面会', '学长学姐带你逛校园：图书馆、食堂、实验室一网打尽，现场答疑选课与社团攻略。', '学校正门集合', now() + interval '3 days', now() + interval '3 days' + interval '3 hours', '校学生会'),
      (v_sid, '周末草坪音乐节', '校园乐队 + 民谣弹唱 + 露天电影，带上野餐垫来放松一周的疲惫。', '东区大草坪', now() + interval '6 days', now() + interval '6 days' + interval '4 hours', '音乐社'),
      (v_sid, '考研经验分享会', '上岸学长学姐现场分享择校、复习规划与复试技巧，自由问答环节。', '图书馆报告厅', now() + interval '10 days', now() + interval '10 days' + interval '2 hours', '考研互助会')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
