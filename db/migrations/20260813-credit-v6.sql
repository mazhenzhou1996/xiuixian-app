-- ============================================================
-- 修仙问答 · 信誉系统迁移 v6 (2026-08-13)
-- 信用分 / 扣分记录 / 量化规则(自动禁言·封禁)
-- 在 Supabase SQL Editor 执行(可重复执行)
-- ============================================================

-- ---------- 1. 信用分列(初始 100) ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit INTEGER DEFAULT 100;

-- ---------- 2. 扣分记录表 ----------
CREATE TABLE IF NOT EXISTS public.credit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,                -- 负数=扣分, 正数=恢复
  reason TEXT NOT NULL,
  source TEXT DEFAULT 'manual',          -- manual | auto_rule | admin
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cl_user ON public.credit_logs(user_id, created_at DESC);

ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cl_read_own" ON public.credit_logs;
CREATE POLICY "cl_read_own" ON public.credit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cl_admin_all" ON public.credit_logs;
CREATE POLICY "cl_admin_all" ON public.credit_logs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------- 3. 量化扣分 RPC(扣分 + 记录 + 阈值自动处理) ----------
-- 量化规则(阈值随扣分自动触发):
--   信用分 < 60  → 自动禁言 1 天
--   信用分 < 30  → 自动禁言 7 天
--   信用分 <= 0  → 自动封禁 7 天
CREATE OR REPLACE FUNCTION public.admin_deduct_credit(p_uid UUID, p_delta INTEGER, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  new_credit INTEGER;
  action TEXT := 'none';
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION '分数不能为 0'; END IF;
  IF p_uid = auth.uid() THEN RAISE EXCEPTION '不能操作自己'; END IF;

  UPDATE public.profiles
  SET credit = GREATEST(0, credit + p_delta)
  WHERE id = p_uid
  RETURNING credit INTO new_credit;

  INSERT INTO public.credit_logs (user_id, delta, reason, source, created_by)
  VALUES (p_uid, p_delta, COALESCE(p_reason, ''), 'manual', auth.uid());

  -- 量化规则:自动施加惩罚(仅当用户当前无生效惩罚时)
  IF NOT EXISTS (SELECT 1 FROM public.user_penalties
                 WHERE user_id = p_uid AND status = 'active'
                   AND (until IS NULL OR until > NOW())) THEN
    IF new_credit <= 0 THEN
      PERFORM public.admin_penalize_user(p_uid, 'ban', 0, NOW() + interval '7 days', '信誉分归零，自动封禁 7 天');
      action := 'ban_7d';
    ELSIF new_credit < 30 THEN
      PERFORM public.admin_penalize_user(p_uid, 'mute', 168, NULL, '信誉分低于 30，自动禁言 7 天');
      action := 'mute_7d';
    ELSIF new_credit < 60 THEN
      PERFORM public.admin_penalize_user(p_uid, 'mute', 24, NULL, '信誉分低于 60，自动禁言 1 天');
      action := 'mute_1d';
    END IF;
  END IF;

  RETURN jsonb_build_object('credit', new_credit, 'action', action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 4. 查询我的信誉 RPC ----------
CREATE OR REPLACE FUNCTION public.get_my_credit()
RETURNS TABLE (credit INTEGER, logs JSONB) AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    (SELECT credit FROM public.profiles WHERE id = uid),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('delta', delta, 'reason', reason, 'source', source, 'created_at', created_at)
        ORDER BY created_at DESC)
      FROM (SELECT delta, reason, source, created_at FROM public.credit_logs WHERE user_id = uid ORDER BY created_at DESC LIMIT 50) t
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 5. 管理员列表加信用分 ----------
DROP FUNCTION IF EXISTS public.admin_list_users(text);

CREATE OR REPLACE FUNCTION public.admin_list_users(kw TEXT DEFAULT '')
RETURNS TABLE (
  id UUID, phone TEXT, nickname TEXT, avatar TEXT, realm TEXT, points INTEGER,
  is_admin BOOLEAN, created_at TIMESTAMPTZ, credit INTEGER,
  penalty_type TEXT, penalty_until TIMESTAMPTZ, penalty_reason TEXT, penalty_id BIGINT
) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT p.id, p.phone, p.nickname, p.avatar, p.realm, p.points, p.is_admin, p.created_at,
         COALESCE(p.credit, 100),
         up.type, up.until, up.reason, up.id
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT * FROM public.user_penalties up2
    WHERE up2.user_id = p.id AND up2.status = 'active'
      AND (up2.until IS NULL OR up2.until > NOW())
    ORDER BY up2.id DESC LIMIT 1
  ) up ON true
  WHERE kw = '' OR p.nickname ILIKE '%' || kw || '%' OR p.phone ILIKE '%' || kw || '%'
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 6. 查询用户信誉记录(管理员) ----------
CREATE OR REPLACE FUNCTION public.admin_list_credit_logs(p_uid UUID)
RETURNS TABLE (id BIGINT, delta INTEGER, reason TEXT, source TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT cl.id, cl.delta, cl.reason, cl.source, cl.created_at
  FROM public.credit_logs cl
  WHERE cl.user_id = p_uid
  ORDER BY cl.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
