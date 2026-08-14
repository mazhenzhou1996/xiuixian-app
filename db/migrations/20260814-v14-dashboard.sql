-- ============================================================
-- v14 管理后台数据看板统计 RPC
-- admin_dashboard_stats()：返回总量 / 近 14 天趋势 / 内容状态分布 / 本校 Top10
-- 仅管理员可调用（SECURITY DEFINER + is_admin 校验）
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_admin boolean;
  v_totals   jsonb;
  v_daily    jsonb;
  v_status   jsonb;
  v_schools  jsonb;
BEGIN
  SELECT COALESCE(is_admin, false) INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'questions', (SELECT count(*) FROM public.questions),
    'answers',   (SELECT count(*) FROM public.answers),
    'users',     (SELECT count(*) FROM public.profiles),
    'schools',   (SELECT count(*) FROM public.universities)
  ) INTO v_totals;

  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb) INTO v_daily FROM (
    SELECT to_char(d, 'MM-DD') AS date,
           (SELECT count(*) FROM public.questions WHERE date_trunc('day', created_at) = d) AS questions,
           (SELECT count(*) FROM public.answers   WHERE date_trunc('day', created_at) = d) AS answers
    FROM generate_series(now() - interval '13 days', now(), '1 day') d
  ) d;

  SELECT jsonb_build_object(
    'active',  (SELECT count(*) FROM public.questions WHERE status = 'active'),
    'pending', (SELECT count(*) FROM public.questions WHERE status = 'pending'),
    'flagged', (SELECT count(*) FROM public.questions WHERE status = 'flagged'),
    'deleted', (SELECT count(*) FROM public.questions WHERE status = 'deleted')
  ) INTO v_status;

  SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) INTO v_schools FROM (
    SELECT u.name, count(q.id) AS count
    FROM public.questions q
    JOIN public.universities u ON u.id = q.school_id
    GROUP BY u.name
    ORDER BY count DESC
    LIMIT 10
  ) s;

  RETURN jsonb_build_object(
    'totals', v_totals, 'daily', v_daily, 'status', v_status, 'topSchools', v_schools
  );
END;
$$;
