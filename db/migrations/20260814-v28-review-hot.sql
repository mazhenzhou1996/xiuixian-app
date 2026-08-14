-- ============================================================
-- 修仙问答 v28 · 审核化 + 本校聚合 + 买热搜（2026-08-14）
-- 覆盖：表白墙审核流 / 学校维度（表白/失物）/ 评选全网与历史校友 /
--       热搜购买 / 点赞扩展
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 表白墙：学校维度 + 审核流 ----------
ALTER TABLE public.confessions ADD COLUMN IF NOT EXISTS school_id integer REFERENCES public.universities(id);
ALTER TABLE public.confessions ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
-- 状态增加 pending（待审核）；存量 active 保留
ALTER TABLE public.confessions DROP CONSTRAINT IF EXISTS confessions_status_check;
ALTER TABLE public.confessions ADD CONSTRAINT confessions_status_check
  CHECK (status IN ('active', 'pending', 'hidden', 'deleted'));

-- 发布表白：默认 pending（后台审核通过才展示），入审核队列
CREATE OR REPLACE FUNCTION public.create_confession(
  p_content text, p_to_name text DEFAULT '', p_is_anonymous boolean DEFAULT true,
  p_image text DEFAULT '', p_school_id integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_id integer; v_flag text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_content IS NULL OR length(p_content) < 2 THEN RAISE EXCEPTION '表白内容至少2个字'; END IF;
  IF length(p_content) > 500 THEN RAISE EXCEPTION '内容最多500字'; END IF;
  INSERT INTO public.confessions(user_id, to_name, content, is_anonymous, image, school_id, status)
  VALUES (v_uid, coalesce(p_to_name, ''), p_content, coalesce(p_is_anonymous, true),
          coalesce(p_image, ''), p_school_id, 'pending')
  RETURNING id INTO v_id;
  INSERT INTO public.content_reviews(target_type, target_id, user_id, matched_keyword)
  VALUES ('confession', v_id, v_uid, '新表白投稿');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'confession_create', jsonb_build_object('id', v_id));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'pending', true);
END $$;

-- 表白列表：仅展示已审核（支持学校过滤）
CREATE OR REPLACE FUNCTION public.list_confessions(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0, p_school_id integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'to_name', c.to_name, 'content', c.content,
    'is_anonymous', c.is_anonymous, 'image', c.image,
    'pinned', c.pinned_until > now(), 'featured', c.featured_until > now(),
    'like_count', c.like_count, 'created_at', c.created_at,
    'user_id', c.user_id, 'school_id', c.school_id,
    'user_nickname', CASE WHEN c.is_anonymous THEN NULL ELSE p.nickname END,
    'user_avatar', CASE WHEN c.is_anonymous THEN NULL ELSE p.avatar END
  ) ORDER BY (c.featured_until > now()) DESC, (c.pinned_until > now()) DESC, c.created_at DESC), '[]')
  INTO v_rows
  FROM public.confessions c
  LEFT JOIN public.profiles_public p ON p.id = c.user_id
  WHERE c.status = 'active' AND (p_school_id IS NULL OR c.school_id = p_school_id)
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;

-- 审核队列扩展：content_reviews.target_type 支持 confession / candidate
ALTER TABLE public.content_reviews DROP CONSTRAINT IF EXISTS content_reviews_target_type_check;
ALTER TABLE public.content_reviews ADD CONSTRAINT content_reviews_target_type_check
  CHECK (target_type IN ('question', 'answer', 'confession', 'candidate'));

-- 审核表白（通过→active；拒绝→hidden）
CREATE OR REPLACE FUNCTION public.review_confession(p_review_id integer, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin uuid := auth.uid(); v_row public.content_reviews%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO v_row FROM public.content_reviews WHERE id = p_review_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '审核记录不存在或已处理'; END IF;
  IF v_row.target_type = 'confession' THEN
    UPDATE public.confessions SET status = CASE WHEN p_approve THEN 'active' ELSE 'hidden' END
      WHERE id = v_row.target_id;
  ELSIF v_row.target_type = 'candidate' THEN
    UPDATE public.beauty_candidates SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
      WHERE id = v_row.target_id;
  ELSE
    RAISE EXCEPTION '仅支持表白/候选审核';
  END IF;
  UPDATE public.content_reviews SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_admin, reviewed_at = now(), matched_keyword = p_reason
    WHERE id = p_review_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 表白点赞
CREATE OR REPLACE FUNCTION public.toggle_confession_like(p_confession_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_liked boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE user_id = v_uid AND target_type = 'confession' AND target_id = p_confession_id) INTO v_liked;
  IF v_liked THEN
    DELETE FROM public.likes WHERE user_id = v_uid AND target_type = 'confession' AND target_id = p_confession_id;
    UPDATE public.confessions SET like_count = greatest(like_count - 1, 0) WHERE id = p_confession_id;
  ELSE
    INSERT INTO public.likes(user_id, target_type, target_id) VALUES (v_uid, 'confession', p_confession_id)
      ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
    UPDATE public.confessions SET like_count = like_count + 1 WHERE id = p_confession_id;
  END IF;
  RETURN NOT v_liked;
END $$;

-- ---------- 2. 失物招领：学校维度 + 点赞 ----------
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS school_id integer REFERENCES public.universities(id);
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.create_lost_item(
  p_kind text, p_category text, p_title text, p_description text DEFAULT '',
  p_image text DEFAULT '', p_location text DEFAULT '', p_contact text DEFAULT '',
  p_school_id integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_id integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_title IS NULL OR length(p_title) < 2 THEN RAISE EXCEPTION '标题至少2个字'; END IF;
  INSERT INTO public.lost_items(user_id, kind, category, title, description, image, location, contact, school_id)
  VALUES (v_uid, p_kind, coalesce(p_category, '其他'), p_title, coalesce(p_description, ''),
          coalesce(p_image, ''), coalesce(p_location, ''), coalesce(p_contact, ''), p_school_id)
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
    'like_count', l.like_count, 'created_at', l.created_at,
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

CREATE OR REPLACE FUNCTION public.toggle_lost_like(p_item_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_liked boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE user_id = v_uid AND target_type = 'lost' AND target_id = p_item_id) INTO v_liked;
  IF v_liked THEN
    DELETE FROM public.likes WHERE user_id = v_uid AND target_type = 'lost' AND target_id = p_item_id;
    UPDATE public.lost_items SET like_count = greatest(like_count - 1, 0) WHERE id = p_item_id;
  ELSE
    INSERT INTO public.likes(user_id, target_type, target_id) VALUES (v_uid, 'lost', p_item_id)
      ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
    UPDATE public.lost_items SET like_count = like_count + 1 WHERE id = p_item_id;
  END IF;
  RETURN NOT v_liked;
END $$;

-- ---------- 3. 评选：全网/历史校友 + 点赞 ----------
ALTER TABLE public.beauty_activities ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'campus'
  CHECK (scope IN ('campus', 'national', 'history'));
ALTER TABLE public.beauty_candidates ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.beauty_candidates ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user'
  CHECK (source IN ('user', 'auto', 'admin'));

-- 全网榜自动提取：各校活动前三入围 national 活动（管理员触发）
CREATE OR REPLACE FUNCTION public.sync_national_candidates(p_national_activity_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_added integer := 0;
  v_cand record;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  FOR v_cand IN
    SELECT c.id, c.user_id, c.photo, c.slogan, c.votes
    FROM (
      SELECT c.*, row_number() OVER (PARTITION BY a.campus_id ORDER BY c.votes DESC) AS rn
      FROM public.beauty_candidates c
      JOIN public.beauty_activities a ON a.id = c.activity_id
      WHERE c.status = 'approved' AND a.scope = 'campus' AND a.status = 'active'
    ) c
    WHERE c.rn <= 3
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.beauty_candidates WHERE activity_id = p_national_activity_id AND user_id = v_cand.user_id) THEN
      INSERT INTO public.beauty_candidates(activity_id, user_id, photo, slogan, status, source)
      VALUES (p_national_activity_id, v_cand.user_id, v_cand.photo, v_cand.slogan, 'pending', 'auto');
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'added', v_added);
END $$;

-- 候选点赞
CREATE OR REPLACE FUNCTION public.toggle_candidate_like(p_candidate_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_liked boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE user_id = v_uid AND target_type = 'candidate' AND target_id = p_candidate_id) INTO v_liked;
  IF v_liked THEN
    DELETE FROM public.likes WHERE user_id = v_uid AND target_type = 'candidate' AND target_id = p_candidate_id;
    UPDATE public.beauty_candidates SET like_count = greatest(like_count - 1, 0) WHERE id = p_candidate_id;
  ELSE
    INSERT INTO public.likes(user_id, target_type, target_id) VALUES (v_uid, 'candidate', p_candidate_id)
      ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
    UPDATE public.beauty_candidates SET like_count = like_count + 1 WHERE id = p_candidate_id;
  END IF;
  RETURN NOT v_liked;
END $$;

-- ---------- 4. 买热搜 ----------
CREATE TABLE IF NOT EXISTS public.hot_search (
  id serial PRIMARY KEY,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  title text NOT NULL,
  heat integer NOT NULL DEFAULT 0,           -- 热度（购买累加）
  paid_until timestamptz NOT NULL,           -- 到期时间
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hot_search ON public.hot_search(status, heat DESC);
ALTER TABLE public.hot_search ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hs_read" ON public.hot_search;
CREATE POLICY "hs_read" ON public.hot_search FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "hs_admin" ON public.hot_search;
CREATE POLICY "hs_admin" ON public.hot_search FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 购买热搜：¥10/24h（提问者或管理员），热度累加，展示在首页热搜榜
CREATE OR REPLACE FUNCTION public.buy_hot_search(p_question_id integer, p_hours integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_price integer;
  v_owner uuid;
  v_title text;
  v_hsid integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_hours < 6 OR p_hours > 168 THEN RAISE EXCEPTION '时长 6-168 小时'; END IF;
  v_price := p_hours * 10;  -- ¥10/天
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（热搜 ¥% ）', v_price; END IF;
  SELECT user_id, title INTO v_owner, v_title FROM public.questions WHERE id = p_question_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '问题不存在'; END IF;
  IF v_owner <> v_uid AND NOT is_admin() THEN RAISE EXCEPTION '只能为自己的问题购买热搜'; END IF;
  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
  SELECT id INTO v_hsid FROM public.hot_search WHERE question_id = p_question_id AND status = 'active';
  IF v_hsid IS NULL THEN
    INSERT INTO public.hot_search(question_id, title, heat, paid_until)
    VALUES (p_question_id, left(v_title, 30), v_price, now() + (p_hours || ' hours')::interval)
    RETURNING id INTO v_hsid;
  ELSE
    UPDATE public.hot_search SET heat = heat + v_price,
           paid_until = greatest(paid_until, now() + (p_hours || ' hours')::interval)
      WHERE id = v_hsid;
  END IF;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '购买热搜（问题 #' || p_question_id || '，' || p_hours || '小时）', 'hotsearch');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'hot_search_buy', jsonb_build_object('question', p_question_id, 'price', v_price));
  RETURN jsonb_build_object('ok', true, 'heat', v_price);
END $$;

-- 热搜榜（有效期内按热度）
CREATE OR REPLACE FUNCTION public.list_hot_search(p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', h.id, 'question_id', h.question_id, 'title', h.title,
    'heat', h.heat, 'paid_until', h.paid_until
  ) ORDER BY h.heat DESC), '[]')
  INTO v_rows
  FROM public.hot_search h
  WHERE h.status = 'active' AND h.paid_until > now()
  LIMIT p_limit;
  RETURN v_rows;
END $$;
