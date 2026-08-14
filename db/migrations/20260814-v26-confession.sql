-- ============================================================
-- 修仙问答 v26 · 表白墙迁移（2026-08-14）
-- 变现：置顶 ¥2/24h、精选 ¥5/24h（余额支付，平台收入，与打赏分离）
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

CREATE TABLE IF NOT EXISTS public.confessions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_name text DEFAULT '',                       -- 表白对象（可空=公开表白）
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT true,    -- 匿名发布（默认匿名，保护隐私）
  image text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  pinned_until timestamptz,                      -- 置顶截止（¥2/24h）
  featured_until timestamptz,                    -- 精选截止（¥5/24h）
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_confessions_feed ON public.confessions(status, featured_until DESC NULLS LAST, pinned_until DESC NULLS LAST, created_at DESC);
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conf_read" ON public.confessions;
CREATE POLICY "conf_read" ON public.confessions FOR SELECT TO anon, authenticated USING (status = 'active' OR auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "conf_insert" ON public.confessions;
CREATE POLICY "conf_insert" ON public.confessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "conf_own_update" ON public.confessions;
CREATE POLICY "conf_own_update" ON public.confessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- 表白点赞（复用 likes 表 target_type='confession'）
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

-- 发布表白（免费；自动内容审核：命中敏感词隐藏）
CREATE OR REPLACE FUNCTION public.create_confession(
  p_content text, p_to_name text DEFAULT '', p_is_anonymous boolean DEFAULT true, p_image text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_id integer; v_flag text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_content IS NULL OR length(p_content) < 2 THEN RAISE EXCEPTION '表白内容至少2个字'; END IF;
  IF length(p_content) > 500 THEN RAISE EXCEPTION '内容最多500字'; END IF;
  v_flag := public.check_content(p_content || ' ' || coalesce(p_to_name, ''));
  INSERT INTO public.confessions(user_id, to_name, content, is_anonymous, image, status)
  VALUES (v_uid, coalesce(p_to_name, ''), p_content, coalesce(p_is_anonymous, true), coalesce(p_image, ''),
          CASE WHEN v_flag IS NULL THEN 'active' ELSE 'hidden' END)
  RETURNING id INTO v_id;
  IF v_flag IS NOT NULL THEN
    INSERT INTO public.content_reviews(target_type, target_id, user_id, matched_keyword)
    VALUES ('question', v_id, v_uid, v_flag);
  END IF;
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'confession_create', jsonb_build_object('id', v_id));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'hidden', v_flag IS NOT NULL);
END $$;

-- 置顶（¥2/24h，余额支付）
CREATE OR REPLACE FUNCTION public.pin_confession(p_id integer, p_days integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_balance integer; v_price integer; v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_days < 1 OR p_days > 7 THEN RAISE EXCEPTION '置顶天数 1-7 天'; END IF;
  v_price := p_days * 2;  -- ¥2/天
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（置顶费 ¥% ）', v_price; END IF;
  SELECT user_id INTO v_owner FROM public.confessions WHERE id = p_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION '只能置顶自己的表白'; END IF;
  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
  UPDATE public.confessions SET pinned_until = now() + (p_days || ' days')::interval WHERE id = p_id;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '表白置顶 #' || p_id || '（' || p_days || '天）', 'pin');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'confession_pin', jsonb_build_object('id', p_id, 'price', v_price));
  RETURN jsonb_build_object('ok', true, 'price', v_price);
END $$;

-- 精选（¥5/24h：墙顶 banner 位，需内容审核通过）
CREATE OR REPLACE FUNCTION public.feature_confession(p_id integer, p_days integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_balance integer; v_price integer; v_owner uuid; v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_days < 1 OR p_days > 7 THEN RAISE EXCEPTION '精选天数 1-7 天'; END IF;
  v_price := p_days * 5;  -- ¥5/天
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（精选费 ¥% ）', v_price; END IF;
  SELECT user_id, status INTO v_owner, v_status FROM public.confessions WHERE id = p_id;
  IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION '只能精选自己的表白'; END IF;
  IF v_status <> 'active' THEN RAISE EXCEPTION '内容未通过审核，无法精选'; END IF;
  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
  UPDATE public.confessions SET featured_until = now() + (p_days || ' days')::interval WHERE id = p_id;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '表白精选 #' || p_id || '（' || p_days || '天）', 'feature');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'confession_feature', jsonb_build_object('id', p_id, 'price', v_price));
  RETURN jsonb_build_object('ok', true, 'price', v_price);
END $$;

-- 列表（精选 > 置顶 > 时间）
CREATE OR REPLACE FUNCTION public.list_confessions(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'to_name', c.to_name, 'content', c.content,
    'is_anonymous', c.is_anonymous, 'image', c.image,
    'pinned', c.pinned_until > now(), 'featured', c.featured_until > now(),
    'like_count', c.like_count, 'created_at', c.created_at,
    'user_id', c.user_id,
    'user_nickname', CASE WHEN c.is_anonymous THEN NULL ELSE p.nickname END,
    'user_avatar', CASE WHEN c.is_anonymous THEN NULL ELSE p.avatar END
  ) ORDER BY (c.featured_until > now()) DESC, (c.pinned_until > now()) DESC, c.created_at DESC), '[]')
  INTO v_rows
  FROM public.confessions c
  LEFT JOIN public.profiles_public p ON p.id = c.user_id
  WHERE c.status = 'active'
  LIMIT p_limit OFFSET p_offset;
  RETURN v_rows;
END $$;
