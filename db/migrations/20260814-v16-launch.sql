-- ============================================================
-- 修仙问答 v16 · 上线版迁移（2026-08-14）
-- 覆盖：排行榜 RPC（替代前端全量过滤）/ 学校体系统一 /
--       create_question 同步学校 / 通知配套索引
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 排行榜：按境界查询 RPC（用户量大了也可扩展） ----------
CREATE OR REPLACE FUNCTION public.get_rankings_by_realm(
  p_realm text DEFAULT 'huashen',
  p_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'nickname', nickname, 'avatar', avatar, 'realm', realm,
    'stage', stage, 'points', points, 'bio', bio
  ) ORDER BY points DESC), '[]')
  INTO v_rows
  FROM public.profiles_public
  WHERE realm = p_realm
  LIMIT p_limit;
  RETURN v_rows;
END $$;

-- 修复存量：stage 为空时按 points 推导小境界（化神:10000+ / 元婴:5000+ / 结丹:2000+ / 筑基:500+ / 练气:其他）
UPDATE public.profiles SET stage = 'late'
  WHERE stage IS NULL AND realm = 'huashen' AND points >= 10000;
UPDATE public.profiles SET stage = 'mid'
  WHERE stage IS NULL AND realm = 'huashen' AND points >= 5000 AND points < 10000;
UPDATE public.profiles SET stage = 'early'
  WHERE stage IS NULL AND realm = 'huashen' AND points < 5000;
UPDATE public.profiles SET stage = 'mid'
  WHERE stage IS NULL AND realm = 'yuanying' AND points >= 5000;
UPDATE public.profiles SET stage = 'early'
  WHERE stage IS NULL AND realm = 'yuanying' AND points < 5000;
UPDATE public.profiles SET stage = 'early'
  WHERE stage IS NULL AND realm IN ('jiedan', 'zhuji', 'lianqi');

-- ---------- 2. 学校体系统一：profiles 挂 school_id（FK） ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id integer REFERENCES public.universities(id);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id) WHERE school_id IS NOT NULL;

-- profiles_public 视图暴露 school_id（用于道友主页/圈子推荐）
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, nickname, avatar, realm, stage, points, bio, school, school_id, created_at
FROM public.profiles;

-- ---------- 3. 提问时同步学校（发布 RPC 增强：选校即绑定圈子） ----------
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
  v_school_name text;
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
  -- 同步用户学校绑定（选校提问 → 成为该圈子成员；已有绑定则不覆盖）
  IF p_school_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND school_id IS NOT NULL
  ) THEN
    SELECT name INTO v_school_name FROM public.universities WHERE id = p_school_id;
    UPDATE public.profiles
      SET school_id = p_school_id,
          school = COALESCE(v_school_name, school)
      WHERE id = v_uid;
  END IF;
  RETURN jsonb_build_object('id', v_qid, 'pending', coalesce(p_is_anonymous, false), 'flagged', v_flag IS NOT NULL);
END $$;

-- 资料页保存学校 RPC（统一走服务端，校验学校存在）
CREATE OR REPLACE FUNCTION public.save_my_school(p_school_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT name INTO v_name FROM public.universities WHERE id = p_school_id;
  IF v_name IS NULL THEN RAISE EXCEPTION '学校不存在'; END IF;
  UPDATE public.profiles SET school_id = p_school_id, school = v_name WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'school_id', p_school_id, 'school', v_name);
END $$;

-- ---------- 4. 通知配套 ----------
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(user_id, created_at DESC);
