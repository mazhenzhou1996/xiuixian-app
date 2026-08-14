-- ============================================================
-- 修仙问答 v27 · 九宫格广告独立化 + 后台管理 + 评选周期榜（2026-08-14）
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 每校九宫格独立广告开关 ----------
ALTER TABLE public.service_contents ADD COLUMN IF NOT EXISTS ad_unlock boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_service_contents_uni ON public.service_contents(university_id, service_id);
-- 存量迁移：原全局开启广告解锁的服务项，其所有学校内容同步开启（保持行为一致）
UPDATE public.service_contents sc SET ad_unlock = true
WHERE EXISTS (SELECT 1 FROM public.topic_services ts WHERE ts.id = sc.service_id AND ts.ad_unlock);

-- ---------- 2. 后台管理 RPC ----------

-- 后台：失物/寻物全量列表（含用户信息）
CREATE OR REPLACE FUNCTION public.admin_list_lost(p_status text DEFAULT 'all', p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'kind', l.kind, 'category', l.category, 'title', l.title,
    'description', l.description, 'location', l.location, 'contact', l.contact,
    'status', l.status, 'pinned', l.pinned_until > now(),
    'created_at', l.created_at, 'user_id', l.user_id,
    'user_nickname', p.nickname
  ) ORDER BY l.created_at DESC), '[]')
  INTO v_rows
  FROM public.lost_items l
  LEFT JOIN public.profiles_public p ON p.id = l.user_id
  WHERE p_status = 'all' OR l.status = p_status
  LIMIT p_limit;
  RETURN v_rows;
END $$;

-- 后台：悬赏/跑腿全量列表（含类型/校区）
CREATE OR REPLACE FUNCTION public.admin_list_bounties(p_bounty_type text DEFAULT 'all', p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'title', b.title, 'content', b.content, 'total_amount', b.total_amount,
    'bounty_type', b.bounty_type, 'status', b.status, 'contact', b.contact,
    'campus', c.name, 'created_at', b.created_at,
    'owner_id', b.owner_id, 'owner_name', p.nickname,
    'answer_count', (SELECT count(*) FROM public.bounty_answers a WHERE a.bounty_id = b.id)
  ) ORDER BY b.created_at DESC), '[]')
  INTO v_rows
  FROM public.bounties b
  LEFT JOIN public.profiles_public p ON p.id = b.owner_id
  LEFT JOIN public.campuses c ON c.id = b.campus_id
  WHERE p_bounty_type = 'all' OR b.bounty_type = p_bounty_type
  LIMIT p_limit;
  RETURN v_rows;
END $$;

-- 后台：下架失物/悬赏（软处理）
CREATE OR REPLACE FUNCTION public.admin_close_lost(p_item_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  UPDATE public.lost_items SET status = 'closed' WHERE id = p_item_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_close_bounty(p_bounty_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  UPDATE public.bounties SET status = 'closed' WHERE id = p_bounty_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- 3. 评选周期榜单（月/季/年） ----------
CREATE OR REPLACE FUNCTION public.get_beauty_ranking_by_period(
  p_activity_id integer, p_period text DEFAULT 'all'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rows jsonb;
  v_since timestamptz;
BEGIN
  IF p_period = 'month' THEN v_since := date_trunc('month', now());
  ELSIF p_period = 'quarter' THEN v_since := date_trunc('quarter', now());
  ELSIF p_period = 'year' THEN v_since := date_trunc('year', now());
  ELSE v_since := NULL; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'user_id', c.user_id, 'photo', c.photo, 'slogan', c.slogan,
    'votes', coalesce(v.period_votes, 0), 'nickname', p.nickname, 'avatar', p.avatar,
    'realm', p.realm, 'school', p.school
  ) ORDER BY v.period_votes DESC NULLS LAST), '[]')
  INTO v_rows
  FROM public.beauty_candidates c
  JOIN public.profiles_public p ON p.id = c.user_id
  LEFT JOIN (
    SELECT candidate_id, sum(weight) AS period_votes
    FROM public.beauty_votes
    WHERE activity_id = p_activity_id
      AND (v_since IS NULL OR created_at >= v_since)
    GROUP BY candidate_id
  ) v ON v.candidate_id = c.id
  WHERE c.activity_id = p_activity_id AND c.status = 'approved';
  RETURN v_rows;
END $$;
