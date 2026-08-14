-- ============================================================
-- 修仙问答 v25 · 失物招领 + 悬赏物品/跑腿 + 校花校草评选（2026-08-14）
-- 安全模式：平台不托管用户间资金；仅收置顶费/投票费/发布服务费（余额扣款，与打赏分离）
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ============ A. 失物招领 ============

CREATE TABLE IF NOT EXISTS public.lost_items (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lost', 'found')),     -- 寻物 / 拾到
  category text NOT NULL DEFAULT '其他',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text DEFAULT '',
  location text DEFAULT '',                                  -- 丢失/拾到地点
  contact text DEFAULT '',                                   -- 联系方式（展示给认领人）
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'closed')),
  pinned_until timestamptz,                                  -- 置顶截止（付费置顶）
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON public.lost_items(status, pinned_until DESC NULLS LAST, created_at DESC);
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lost_read" ON public.lost_items;
CREATE POLICY "lost_read" ON public.lost_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "lost_insert" ON public.lost_items;
CREATE POLICY "lost_insert" ON public.lost_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "lost_own_update" ON public.lost_items;
CREATE POLICY "lost_own_update" ON public.lost_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- 发布失物/拾到（免费）
CREATE OR REPLACE FUNCTION public.create_lost_item(
  p_kind text, p_category text, p_title text, p_description text DEFAULT '',
  p_image text DEFAULT '', p_location text DEFAULT '', p_contact text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_id integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_title IS NULL OR length(p_title) < 2 THEN RAISE EXCEPTION '标题至少2个字'; END IF;
  INSERT INTO public.lost_items(user_id, kind, category, title, description, image, location, contact)
  VALUES (v_uid, p_kind, coalesce(p_category, '其他'), p_title, coalesce(p_description, ''),
          coalesce(p_image, ''), coalesce(p_location, ''), coalesce(p_contact, ''))
  RETURNING id INTO v_id;
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'lost_create', jsonb_build_object('id', v_id, 'kind', p_kind));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- 置顶（¥1/24h，余额支付；平台收入，与打赏分离）
CREATE OR REPLACE FUNCTION public.pin_lost_item(p_item_id integer, p_days integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_balance integer; v_price integer; v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_days < 1 OR p_days > 30 THEN RAISE EXCEPTION '置顶天数 1-30 天'; END IF;
  v_price := p_days;  -- ¥1/天
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（置顶费 ¥% ）', v_price; END IF;
  SELECT user_id INTO v_owner FROM public.lost_items WHERE id = p_item_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '信息不存在'; END IF;
  IF v_owner <> v_uid AND NOT is_admin() THEN RAISE EXCEPTION '只能置顶自己的信息'; END IF;
  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
  UPDATE public.lost_items SET pinned_until = now() + (p_days || ' days')::interval WHERE id = p_item_id;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '失物招领置顶 #' || p_item_id || '（' || p_days || '天）', 'pin');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'lost_pin', jsonb_build_object('id', p_item_id, 'price', v_price));
  RETURN jsonb_build_object('ok', true, 'price', v_price);
END $$;

-- 标记已找到/结案
CREATE OR REPLACE FUNCTION public.resolve_lost_item(p_item_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  UPDATE public.lost_items SET status = 'resolved'
    WHERE id = p_item_id AND (user_id = auth.uid() OR is_admin());
  RETURN jsonb_build_object('ok', true);
END $$;

-- 列表（置顶优先）
CREATE OR REPLACE FUNCTION public.list_lost_items(p_kind text DEFAULT 'all', p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'kind', l.kind, 'category', l.category, 'title', l.title,
    'description', l.description, 'image', l.image, 'location', l.location,
    'contact', l.contact, 'status', l.status, 'pinned', l.pinned_until > now(),
    'created_at', l.created_at,
    'user_nickname', p.nickname, 'user_avatar', p.avatar, 'user_id', l.user_id
  ) ORDER BY (l.pinned_until > now()) DESC, l.created_at DESC), '[]')
  INTO v_rows
  FROM public.lost_items l
  JOIN public.profiles_public p ON p.id = l.user_id
  WHERE l.status = 'active' AND (p_kind = 'all' OR l.kind = p_kind)
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;

-- ============ B. 悬赏物品/跑腿服务（bounties 扩展） ============

ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS bounty_type text NOT NULL DEFAULT 'question'
  CHECK (bounty_type IN ('question', 'item', 'service'));
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS campus_id integer REFERENCES public.campuses(id);
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS contact text DEFAULT '';

-- 发布物品/跑腿悬赏（服务费 5%：余额扣 amount + 5%，平台入账服务费；无资金托管，线下交付）
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
  IF p_type NOT IN ('item', 'service') THEN RAISE EXCEPTION '类型仅支持物品/服务'; END IF;
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

-- 悬赏列表支持类型过滤（扩展现有 RPC 兼容：不破坏旧调用）
CREATE OR REPLACE FUNCTION public.list_bounties_v2(p_type text DEFAULT 'all', p_limit integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'title', b.title, 'content', b.content, 'total_amount', b.total_amount,
    'bounty_type', b.bounty_type, 'campus_id', b.campus_id, 'contact', b.contact,
    'owner_id', b.owner_id, 'owner_name', p.nickname, 'status', b.status,
    'answer_count', (SELECT count(*) FROM public.bounty_answers a WHERE a.bounty_id = b.id),
    'created_at', b.created_at
  ) ORDER BY b.created_at DESC), '[]')
  INTO v_rows
  FROM public.bounties b
  JOIN public.profiles_public p ON p.id = b.owner_id
  WHERE b.status = 'open' AND (p_type = 'all' OR b.bounty_type = p_type)
  LIMIT p_limit;
  RETURN v_rows;
END $$;

-- ============ C. 校花校草评选 ============

CREATE TABLE IF NOT EXISTS public.beauty_activities (
  id serial PRIMARY KEY,
  title text NOT NULL,
  gender text NOT NULL DEFAULT 'female' CHECK (gender IN ('female', 'male')),
  campus_id integer REFERENCES public.campuses(id),
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'ended')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beauty_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ba_read" ON public.beauty_activities;
CREATE POLICY "ba_read" ON public.beauty_activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ba_admin" ON public.beauty_activities;
CREATE POLICY "ba_admin" ON public.beauty_activities FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.beauty_candidates (
  id serial PRIMARY KEY,
  activity_id integer NOT NULL REFERENCES public.beauty_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo text NOT NULL DEFAULT '',
  slogan text DEFAULT '',
  votes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)
);
ALTER TABLE public.beauty_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bc_read" ON public.beauty_candidates;
CREATE POLICY "bc_read" ON public.beauty_candidates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bc_insert" ON public.beauty_candidates;
CREATE POLICY "bc_insert" ON public.beauty_candidates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bc_admin" ON public.beauty_candidates;
CREATE POLICY "bc_admin" ON public.beauty_candidates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.beauty_votes (
  id serial PRIMARY KEY,
  activity_id integer NOT NULL REFERENCES public.beauty_activities(id) ON DELETE CASCADE,
  candidate_id integer NOT NULL REFERENCES public.beauty_candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,          -- 免费 1 票=1；付费加票按购买权重
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)               -- 每人每活动一票记录（付费可追加权重）
);
ALTER TABLE public.beauty_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bv_read" ON public.beauty_votes;
CREATE POLICY "bv_read" ON public.beauty_votes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bv_insert" ON public.beauty_votes;
CREATE POLICY "bv_insert" ON public.beauty_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 报名（需本校认证修士）
CREATE OR REPLACE FUNCTION public.apply_beauty_candidate(p_activity_id integer, p_photo text, p_slogan text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_verified boolean; v_act record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT school_verified INTO v_verified FROM public.profiles WHERE id = v_uid;
  IF NOT coalesce(v_verified, false) THEN RAISE EXCEPTION '仅本校认证修士可报名（先去学校圈子申请认证）'; END IF;
  SELECT * INTO v_act FROM public.beauty_activities WHERE id = p_activity_id AND status = 'active';
  IF v_act.id IS NULL THEN RAISE EXCEPTION '活动不存在或未开始'; END IF;
  INSERT INTO public.beauty_candidates(activity_id, user_id, photo, slogan)
  VALUES (p_activity_id, v_uid, p_photo, coalesce(p_slogan, ''))
  ON CONFLICT (activity_id, user_id) DO UPDATE SET photo = EXCLUDED.photo, slogan = EXCLUDED.slogan;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 投票：免费 1 票/天（weight 累加）+ 付费加票（¥1=10 权重，余额支付，平台收入）
CREATE OR REPLACE FUNCTION public.vote_beauty(
  p_activity_id integer, p_candidate_id integer, p_paid_coin integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_act record;
  v_free_weight integer := 1;
  v_balance integer;
  v_price integer;
  v_vote_id integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT * INTO v_act FROM public.beauty_activities WHERE id = p_activity_id AND status = 'active';
  IF v_act.id IS NULL THEN RAISE EXCEPTION '活动不存在或已结束'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.beauty_candidates WHERE id = p_candidate_id AND activity_id = p_activity_id AND status = 'approved') THEN
    RAISE EXCEPTION '候选不存在或未通过审核';
  END IF;
  -- 付费加票：¥1 = 10 权重
  IF p_paid_coin > 0 THEN
    v_price := p_paid_coin;
    SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
    IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（加票 ¥% ）', v_price; END IF;
    UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
    INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
    VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
            '评选加票（活动 #' || p_activity_id || '）', 'vote');
  END IF;
  -- 免费票：每人每活动仅一次（后续调用只加付费权重）
  SELECT id INTO v_vote_id FROM public.beauty_votes WHERE activity_id = p_activity_id AND user_id = v_uid;
  IF v_vote_id IS NULL THEN
    INSERT INTO public.beauty_votes(activity_id, candidate_id, user_id, weight)
    VALUES (p_activity_id, p_candidate_id, v_uid, v_free_weight + p_paid_coin * 10)
    RETURNING id INTO v_vote_id;
  ELSE
    UPDATE public.beauty_votes SET weight = weight + v_free_weight + p_paid_coin * 10,
           candidate_id = p_candidate_id
      WHERE id = v_vote_id;
  END IF;
  UPDATE public.beauty_candidates SET votes = (SELECT sum(weight) FROM public.beauty_votes WHERE candidate_id = p_candidate_id)
    WHERE id = p_candidate_id;
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'beauty_vote', jsonb_build_object('activity', p_activity_id, 'candidate', p_candidate_id, 'paid', p_paid_coin));
  RETURN jsonb_build_object('ok', true, 'weight', v_free_weight + p_paid_coin * 10);
END $$;

-- 活动详情 + 排行榜
CREATE OR REPLACE FUNCTION public.get_beauty_ranking(p_activity_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb; v_act jsonb;
BEGIN
  SELECT jsonb_build_object('id', a.id, 'title', a.title, 'gender', a.gender,
    'campus_id', a.campus_id, 'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status)
    INTO v_act FROM public.beauty_activities a WHERE a.id = p_activity_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'user_id', c.user_id, 'photo', c.photo, 'slogan', c.slogan,
    'votes', c.votes, 'nickname', p.nickname, 'avatar', p.avatar,
    'realm', p.realm, 'school', p.school
  ) ORDER BY c.votes DESC), '[]')
  INTO v_rows
  FROM public.beauty_candidates c
  JOIN public.profiles_public p ON p.id = c.user_id
  WHERE c.activity_id = p_activity_id AND c.status = 'approved';
  RETURN jsonb_build_object('activity', v_act, 'ranking', v_rows);
END $$;
