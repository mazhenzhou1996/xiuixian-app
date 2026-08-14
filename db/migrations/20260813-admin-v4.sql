-- ============================================================
-- 修仙问答 · 管理后台增强迁移 v4 (2026-08-13)
-- 用户申诉表 / 九宫格广告解锁字段
-- 在 Supabase SQL Editor 执行(可重复执行)
-- ============================================================

-- ---------- 1. 用户申诉表 ----------
CREATE TABLE IF NOT EXISTS public.appeals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  penalty_id BIGINT REFERENCES public.user_penalties(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reply TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.appeals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals(status, created_at DESC);

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- 用户可提交/查看自己的申诉；管理员可读写全部
DROP POLICY IF EXISTS "appeals_read_own" ON public.appeals;
CREATE POLICY "appeals_read_own" ON public.appeals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "appeals_insert_own" ON public.appeals;
CREATE POLICY "appeals_insert_own" ON public.appeals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "appeals_admin_all" ON public.appeals;
CREATE POLICY "appeals_admin_all" ON public.appeals
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------- 2. 九宫格服务：广告解锁字段 ----------
ALTER TABLE public.topic_services ADD COLUMN IF NOT EXISTS ad_unlock BOOLEAN DEFAULT false;
ALTER TABLE public.topic_services ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- ---------- 3. 提交申诉 RPC（带校验） ----------
CREATE OR REPLACE FUNCTION public.submit_appeal(p_penalty_id BIGINT, p_reason TEXT)
RETURNS public.appeals AS $$
DECLARE
  new_a appeals;
  uid UUID := auth.uid();
  p user_penalties;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION '申诉理由至少 5 个字';
  END IF;
  -- 校验惩罚归属
  SELECT * INTO p FROM public.user_penalties WHERE id = p_penalty_id;
  IF p.id IS NULL THEN RAISE EXCEPTION '惩罚记录不存在'; END IF;
  IF p.user_id <> uid THEN RAISE EXCEPTION '无权申诉该记录'; END IF;
  -- 同一惩罚只能申诉一次
  IF EXISTS (SELECT 1 FROM public.appeals WHERE user_id = uid AND penalty_id = p_penalty_id AND status = 'pending') THEN
    RAISE EXCEPTION '已有待处理的申诉，请耐心等待';
  END IF;
  INSERT INTO public.appeals (user_id, penalty_id, reason)
  VALUES (uid, p_penalty_id, btrim(p_reason))
  RETURNING * INTO new_a;
  RETURN new_a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 4. 管理员处理申诉 ----------
CREATE OR REPLACE FUNCTION public.admin_review_appeal(p_id BIGINT, p_status TEXT, p_reply TEXT)
RETURNS TEXT AS $$
DECLARE
  a appeals%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  SELECT * INTO a FROM public.appeals WHERE id = p_id;
  IF a.id IS NULL THEN RAISE EXCEPTION '申诉不存在'; END IF;
  UPDATE public.appeals SET status = p_status, admin_reply = COALESCE(p_reply, ''), created_by = auth.uid()
  WHERE id = p_id;
  -- 申诉通过则撤销对应惩罚
  IF p_status = 'approved' AND a.penalty_id IS NOT NULL THEN
    UPDATE public.user_penalties SET status = 'revoked' WHERE id = a.penalty_id AND status = 'active';
  END IF;
  RETURN 'done';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
