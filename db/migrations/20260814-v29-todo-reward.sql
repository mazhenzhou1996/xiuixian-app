-- ============================================================
-- 修仙问答 v29 · 待办跑腿 + 失物悬赏 + 表白墙本校（2026-08-14）
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 悬赏类型增加"待办" ----------
ALTER TABLE public.bounties DROP CONSTRAINT IF EXISTS bounties_bounty_type_check;
ALTER TABLE public.bounties ADD CONSTRAINT bounties_bounty_type_check
  CHECK (bounty_type IN ('question', 'item', 'service', 'todo'));

-- 发布物品/待办/跑腿悬赏（服务费 5%）
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
  IF p_type NOT IN ('item', 'service', 'todo') THEN RAISE EXCEPTION '类型仅支持物品/服务/待办'; END IF;
  v_fee := greatest(1, round(p_amount * 0.05));
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

-- ---------- 2. 失物招领悬赏金额（线下结算，无托管） ----------
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS reward integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_lost_item(
  p_kind text, p_category text, p_title text, p_description text DEFAULT '',
  p_image text DEFAULT '', p_location text DEFAULT '', p_contact text DEFAULT '',
  p_school_id integer DEFAULT NULL, p_reward integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_id integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_title IS NULL OR length(p_title) < 2 THEN RAISE EXCEPTION '标题至少2个字'; END IF;
  IF p_reward < 0 OR p_reward > 500 THEN RAISE EXCEPTION '悬赏金额 0-500 元'; END IF;
  INSERT INTO public.lost_items(user_id, kind, category, title, description, image, location, contact, school_id, reward)
  VALUES (v_uid, p_kind, coalesce(p_category, '其他'), p_title, coalesce(p_description, ''),
          coalesce(p_image, ''), coalesce(p_location, ''), coalesce(p_contact, ''), p_school_id, p_reward)
  RETURNING id INTO v_id;
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'lost_create', jsonb_build_object('id', v_id, 'kind', p_kind));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.list_lost_items(p_kind text DEFAULT 'all', p_limit integer DEFAULT 30, p_offset integer DEFAULT 0, p_school_id integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'kind', l.kind, 'category', l.category, 'title', l.title,
    'description', l.description, 'image', l.image, 'location', l.location,
    'contact', l.contact, 'status', l.status, 'pinned', l.pinned_until > now(),
    'like_count', l.like_count, 'reward', l.reward, 'created_at', l.created_at,
    'user_nickname', p.nickname, 'user_avatar', p.avatar, 'user_id', l.user_id
  ) ORDER BY (l.pinned_until > now()) DESC, l.created_at DESC), '[]')
  INTO v_rows
  FROM public.lost_items l
  JOIN public.profiles_public p ON p.id = l.user_id
  WHERE l.status = 'active' AND (p_kind = 'all' OR l.kind = p_kind)
    AND (p_school_id IS NULL OR l.school_id = p_school_id)
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;
