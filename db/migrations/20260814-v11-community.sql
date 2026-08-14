-- ============================================================
-- 修仙问答 v11 · 社区版升级迁移（2026-08-14）
-- 覆盖：匿名提问/回答+后台审核 / 学校标签 / 赞赏(余额打赏) /
--       收藏夹 / 隐藏主页 / 信息流偏好 / 自动审核 / 封禁模式 /
--       收益统计 / 搜索索引 / 内容可见性 RLS 收紧
-- 全部幂等（IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS）
-- ============================================================

-- ---------- 1. 匿名 + 内容状态字段 ----------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.answers   ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE public.answers   ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.comments  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(status) WHERE status <> 'active';
CREATE INDEX IF NOT EXISTS idx_answers_status   ON public.answers(status) WHERE status <> 'active';

-- ---------- 2. 学校标签 ----------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS school_id integer REFERENCES public.universities(id);
CREATE INDEX IF NOT EXISTS idx_questions_school ON public.questions(school_id) WHERE school_id IS NOT NULL;

-- ---------- 3. 内容可见性 RLS 收紧 ----------
DROP POLICY IF EXISTS "questions_read" ON public.questions;
CREATE POLICY "questions_read" ON public.questions
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "answers_read" ON public.answers;
CREATE POLICY "answers_read" ON public.answers
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "comments_read" ON public.comments;
CREATE POLICY "comments_read" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id OR is_admin());

-- ---------- 4. 匿名内容审核队列 ----------
CREATE TABLE IF NOT EXISTS public.anonymous_reviews (
  id serial PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('question','answer')),
  target_id integer NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_preview text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anon_reviews_status ON public.anonymous_reviews(status);
ALTER TABLE public.anonymous_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_reviews_select" ON public.anonymous_reviews;
CREATE POLICY "anon_reviews_select" ON public.anonymous_reviews
  FOR SELECT TO authenticated USING (is_admin() OR auth.uid() = user_id);
DROP POLICY IF EXISTS "anon_reviews_admin" ON public.anonymous_reviews;
CREATE POLICY "anon_reviews_admin" ON public.anonymous_reviews
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---------- 5. 赞赏 ----------
CREATE TABLE IF NOT EXISTS public.tips (
  id serial PRIMARY KEY,
  answer_id integer NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tips_answer ON public.tips(answer_id);
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS tip_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS tip_amount integer NOT NULL DEFAULT 0;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tips_select" ON public.tips;
CREATE POLICY "tips_select" ON public.tips FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "tips_insert" ON public.tips;
CREATE POLICY "tips_insert" ON public.tips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- 6. 收藏夹 ----------
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT '默认收藏';
CREATE INDEX IF NOT EXISTS idx_favorites_folder ON public.favorites(user_id, folder);

-- ---------- 7. 主页隐藏 + 个性化推荐开关 ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_content boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enable_personalized boolean NOT NULL DEFAULT true;

-- ---------- 8. 自动审核 ----------
CREATE TABLE IF NOT EXISTS public.auto_review_rules (
  id serial PRIMARY KEY,
  keyword text NOT NULL UNIQUE,
  action text NOT NULL DEFAULT 'hidden' CHECK (action IN ('hidden','report')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auto_review_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "arr_admin" ON public.auto_review_rules;
CREATE POLICY "arr_admin" ON public.auto_review_rules FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "arr_read" ON public.auto_review_rules;
CREATE POLICY "arr_read" ON public.auto_review_rules FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.content_reviews (
  id serial PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('question','answer')),
  target_id integer NOT NULL,
  user_id uuid NOT NULL,
  matched_keyword text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON public.content_reviews(status);
ALTER TABLE public.content_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_admin" ON public.content_reviews;
CREATE POLICY "cr_admin" ON public.content_reviews FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---------- 9. 搜索索引 ----------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_questions_title_trgm ON public.questions USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_questions_content_trgm ON public.questions USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_answers_content_trgm ON public.answers USING gin (content gin_trgm_ops);

-- ============ RPC ============

CREATE OR REPLACE FUNCTION public.check_content(p_text text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT keyword FROM public.auto_review_rules
  WHERE enabled AND position(keyword in p_text) > 0
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_question(
  p_title text, p_content text,
  p_type text DEFAULT 'normal',
  p_images text[] DEFAULT '{}',
  p_school_id integer DEFAULT NULL,
  p_is_anonymous boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_qid integer;
  v_flag text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_penalties WHERE user_id = v_uid AND type = 'ban' AND (until IS NULL OR until > now())) THEN
    RAISE EXCEPTION '账号已封禁，仅可浏览';
  END IF;
  IF p_title IS NULL OR length(p_title) < 5 THEN RAISE EXCEPTION '标题至少5个字'; END IF;
  v_flag := public.check_content(p_title || ' ' || coalesce(p_content, ''));
  INSERT INTO public.questions(user_id, title, content, type, images, school_id, is_anonymous, status)
  VALUES (v_uid, p_title, coalesce(p_content, ''), coalesce(p_type, 'normal'), coalesce(p_images, '{}'),
          p_school_id, coalesce(p_is_anonymous, false),
          CASE WHEN p_is_anonymous THEN 'pending' WHEN v_flag IS NULL THEN 'active' ELSE 'hidden' END)
  RETURNING id INTO v_qid;
  IF p_is_anonymous THEN
    INSERT INTO public.anonymous_reviews(target_type, target_id, user_id, content_preview)
    VALUES ('question', v_qid, v_uid, left(p_title, 200));
  ELSIF v_flag IS NOT NULL THEN
    INSERT INTO public.content_reviews(target_type, target_id, user_id, matched_keyword)
    VALUES ('question', v_qid, v_uid, v_flag);
  END IF;
  RETURN jsonb_build_object('id', v_qid, 'pending', coalesce(p_is_anonymous, false), 'flagged', v_flag IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.create_answer(
  p_question_id integer, p_content text,
  p_is_anonymous boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aid integer;
  v_flag text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_penalties WHERE user_id = v_uid AND type = 'ban' AND (until IS NULL OR until > now())) THEN
    RAISE EXCEPTION '账号已封禁，仅可浏览';
  END IF;
  IF p_content IS NULL OR length(p_content) < 2 THEN RAISE EXCEPTION '回答太短'; END IF;
  v_flag := public.check_content(p_content);
  INSERT INTO public.answers(question_id, user_id, content, is_anonymous, status)
  VALUES (p_question_id, v_uid, p_content, coalesce(p_is_anonymous, false),
          CASE WHEN p_is_anonymous THEN 'pending' WHEN v_flag IS NULL THEN 'active' ELSE 'hidden' END)
  RETURNING id INTO v_aid;
  IF p_is_anonymous THEN
    INSERT INTO public.anonymous_reviews(target_type, target_id, user_id, content_preview)
    VALUES ('answer', v_aid, v_uid, left(p_content, 200));
  ELSIF v_flag IS NOT NULL THEN
    INSERT INTO public.content_reviews(target_type, target_id, user_id, matched_keyword)
    VALUES ('answer', v_aid, v_uid, v_flag);
  END IF;
  RETURN jsonb_build_object('id', v_aid, 'pending', coalesce(p_is_anonymous, false), 'flagged', v_flag IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.review_anonymous(p_review_id integer, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.anonymous_reviews%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO v_row FROM public.anonymous_reviews WHERE id = p_review_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '审核记录不存在或已处理'; END IF;
  IF p_approve THEN
    IF v_row.target_type = 'question' THEN
      UPDATE public.questions SET status = 'active' WHERE id = v_row.target_id;
    ELSE
      UPDATE public.answers SET status = 'active' WHERE id = v_row.target_id;
    END IF;
    UPDATE public.anonymous_reviews SET status = 'approved', reviewed_by = v_admin, reviewed_at = now()
    WHERE id = p_review_id;
  ELSE
    IF v_row.target_type = 'question' THEN
      UPDATE public.questions SET status = 'hidden' WHERE id = v_row.target_id;
    ELSE
      UPDATE public.answers SET status = 'hidden' WHERE id = v_row.target_id;
    END IF;
    UPDATE public.anonymous_reviews SET status = 'rejected', reviewed_by = v_admin, reviewed_at = now(), reject_reason = p_reason
    WHERE id = p_review_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.list_anonymous_reviews(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id,
    'content_preview', r.content_preview, 'status', r.status,
    'created_at', r.created_at, 'user_nickname', p.nickname
  ) ORDER BY r.created_at DESC), '[]')
  INTO v_rows
  FROM public.anonymous_reviews r
  LEFT JOIN public.profiles_public p ON p.id = r.user_id
  WHERE r.status = p_status;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.review_content(p_review_id integer, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.content_reviews%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO v_row FROM public.content_reviews WHERE id = p_review_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '复核记录不存在或已处理'; END IF;
  IF p_approve THEN
    IF v_row.target_type = 'question' THEN
      UPDATE public.questions SET status = 'active' WHERE id = v_row.target_id;
    ELSE
      UPDATE public.answers SET status = 'active' WHERE id = v_row.target_id;
    END IF;
  ELSE
    IF v_row.target_type = 'question' THEN
      UPDATE public.questions SET status = 'hidden' WHERE id = v_row.target_id;
    ELSE
      UPDATE public.answers SET status = 'hidden' WHERE id = v_row.target_id;
    END IF;
  END IF;
  UPDATE public.content_reviews SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_admin, reviewed_at = now()
  WHERE id = p_review_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.list_content_reviews(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id,
    'matched_keyword', r.matched_keyword, 'status', r.status,
    'created_at', r.created_at, 'user_nickname', p.nickname
  ) ORDER BY r.created_at DESC), '[]')
  INTO v_rows
  FROM public.content_reviews r
  LEFT JOIN public.profiles_public p ON p.id = r.user_id
  WHERE r.status = p_status;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.create_tip(p_answer_id integer, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_author uuid;
  v_author_nick text;
  v_nick text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_amount <= 0 OR p_amount > 100 THEN RAISE EXCEPTION '单笔赞赏 1-100 元'; END IF;
  SELECT balance, nickname INTO v_balance, v_nick FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL THEN RAISE EXCEPTION '用户不存在'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION '余额不足'; END IF;
  SELECT user_id INTO v_author FROM public.answers WHERE id = p_answer_id;
  IF v_author IS NULL THEN RAISE EXCEPTION '回答不存在'; END IF;
  IF v_author = v_uid THEN RAISE EXCEPTION '不能赞赏自己的回答'; END IF;
  SELECT nickname INTO v_author_nick FROM public.profiles WHERE id = v_author;
  IF v_author_nick IS NULL THEN RAISE EXCEPTION '答主不存在'; END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_uid;
  UPDATE public.profiles SET balance = LEAST(balance + p_amount, 100) WHERE id = v_author;
  INSERT INTO public.tips(answer_id, user_id, amount) VALUES (p_answer_id, v_uid, p_amount);
  UPDATE public.answers SET tip_count = tip_count + 1, tip_amount = tip_amount + p_amount WHERE id = p_answer_id;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -p_amount, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '赞赏回答 #' || p_answer_id || ' → ' || v_author_nick, 'tip');
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_author, p_amount, (SELECT balance FROM public.profiles WHERE id = v_author),
          '收到赞赏 #' || p_answer_id || ' ← ' || v_nick, 'tip');
  RETURN jsonb_build_object('ok', true, 'amount', p_amount);
END $$;

CREATE OR REPLACE FUNCTION public.get_likers(p_target_type text, p_target_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_target_type = 'answer' THEN
    SELECT user_id INTO v_owner FROM public.answers WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    SELECT user_id INTO v_owner FROM public.comments WHERE id = p_target_id;
  ELSE
    RAISE EXCEPTION '仅支持回答/评论的赞同者列表';
  END IF;
  IF v_owner IS NULL THEN RAISE EXCEPTION '目标不存在'; END IF;
  IF v_owner <> v_uid AND NOT is_admin() THEN RAISE EXCEPTION '仅内容作者可见'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nickname', p.nickname, 'avatar', p.avatar, 'realm', p.realm,
    'stage', p.stage, 'points', p.points
  ) ORDER BY l.created_at DESC), '[]')
  INTO v_rows
  FROM public.likes l
  JOIN public.profiles_public p ON p.id = l.user_id
  WHERE l.target_type = p_target_type AND l.target_id = p_target_id;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.get_follow_feed(p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'answer_id', a.id, 'question_id', a.question_id, 'q_title', q.title,
    'content', left(a.content, 120), 'author', p.nickname, 'avatar', p.avatar,
    'realm', p.realm, 'created_at', a.created_at
  ) ORDER BY a.created_at DESC), '[]')
  INTO v_rows
  FROM public.answers a
  JOIN public.follows f ON f.following_id = a.user_id AND f.follower_id = v_uid
  JOIN public.questions q ON q.id = a.question_id AND q.status = 'active'
  JOIN public.profiles_public p ON p.id = a.user_id
  WHERE a.status = 'active'
  ORDER BY a.created_at DESC
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.move_favorite(p_question_id integer, p_folder text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  UPDATE public.favorites SET folder = coalesce(nullif(p_folder, ''), '默认收藏')
  WHERE user_id = auth.uid() AND question_id = p_question_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.get_my_earnings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_earn jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT jsonb_build_object(
    'tip_income', coalesce((SELECT sum(t.amount) FROM public.tips t JOIN public.answers a ON a.id = t.answer_id WHERE a.user_id = v_uid), 0),
    'tip_count',   coalesce((SELECT count(*) FROM public.tips t JOIN public.answers a ON a.id = t.answer_id WHERE a.user_id = v_uid), 0),
    'consult_income', coalesce((SELECT sum(price) FROM public.consultations WHERE expert_id = v_uid AND status IN ('paid','answered','completed')), 0),
    'bounty_income',  coalesce((SELECT sum(delta) FROM public.balance_logs WHERE user_id = v_uid AND reason LIKE '悬赏%' AND delta > 0), 0),
    'balance', coalesce((SELECT balance FROM public.profiles WHERE id = v_uid), 0)
  ) INTO v_earn;
  RETURN v_earn;
END $$;

CREATE OR REPLACE FUNCTION public.get_school_feed(p_school_id integer, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id, 'title', q.title, 'content', left(q.content, 120),
    'hot_score', q.hot_score, 'like_count', q.like_count,
    'answer_count', (SELECT count(*) FROM public.answers a WHERE a.question_id = q.id AND a.status = 'active'),
    'author', p.nickname, 'avatar', p.avatar, 'realm', p.realm,
    'is_anonymous', q.is_anonymous, 'created_at', q.created_at
  ) ORDER BY q.hot_score DESC), '[]')
  INTO v_rows
  FROM public.questions q
  JOIN public.profiles_public p ON p.id = q.user_id
  WHERE q.school_id = p_school_id AND q.status = 'active'
  ORDER BY q.hot_score DESC
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.list_schools()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is985', is_985, 'is211', is_211)), '[]')
  INTO v_rows
  FROM public.universities ORDER BY name;
  RETURN v_rows;
END $$;
