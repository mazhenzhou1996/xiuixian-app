-- ============================================================
-- 修仙问答 v18 · 学校认证 + 九宫格固定项迁移（2026-08-14）
-- 覆盖：学校认证体系（申请/后台审核/认证修士）/ 付费咨询固定格 /
--       认证标识公开视图
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 用户学校认证状态 ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_verified boolean NOT NULL DEFAULT false;

-- ---------- 2. 认证申请表 ----------
CREATE TABLE IF NOT EXISTS public.school_verifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id integer NOT NULL REFERENCES public.universities(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason text DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sv_status ON public.school_verifications(status);
ALTER TABLE public.school_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sv_select_own" ON public.school_verifications;
CREATE POLICY "sv_select_own" ON public.school_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "sv_admin_all" ON public.school_verifications;
CREATE POLICY "sv_admin_all" ON public.school_verifications
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "sv_insert_own" ON public.school_verifications;
CREATE POLICY "sv_insert_own" ON public.school_verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- 3. 九宫格固定项（付费咨询学长学姐：不可删/不可改/不可隐藏/永远第一） ----------
ALTER TABLE public.topic_services ADD COLUMN IF NOT EXISTS fixed boolean NOT NULL DEFAULT false;
UPDATE public.topic_services
  SET fixed = true, enabled = true, sort_order = 0, label = '付费咨询学长学姐'
  WHERE label LIKE '%付费咨询%' OR label LIKE '%学长学姐%';
-- 若库里还没有该服务项，插入固定项（幂等）
INSERT INTO public.topic_services (topic, label, icon, url, description, ad_unlock, sort_order, enabled, fixed)
SELECT 'university', '付费咨询学长学姐', 'Coins', '', '一对一咨询认证学长学姐，付款后解答', false, 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.topic_services WHERE fixed = true);
INSERT INTO public.topic_services (topic, label, icon, url, description, ad_unlock, sort_order, enabled, fixed)
SELECT 'graduate', '付费咨询学长学姐', 'Coins', '', '一对一咨询认证学长学姐，付款后解答', false, 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.topic_services WHERE topic = 'graduate' AND fixed = true);

-- ---------- 4. 认证标识公开视图 ----------
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, nickname, avatar, realm, stage, points, bio, school, school_id, school_verified, created_at
FROM public.profiles;

-- ---------- 5. RPC ----------

-- 申请学校认证（同一学校重复申请 pending 时拒绝）
CREATE OR REPLACE FUNCTION public.apply_school_verification(p_school_id integer, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_verifications
             WHERE user_id = v_uid AND school_id = p_school_id AND status = 'pending') THEN
    RAISE EXCEPTION '已有待审核的认证申请，请耐心等待';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND school_verified) THEN
    RAISE EXCEPTION '你已是认证修士';
  END IF;
  INSERT INTO public.school_verifications(user_id, school_id, reason)
  VALUES (v_uid, p_school_id, coalesce(p_reason, ''));
  RETURN jsonb_build_object('ok', true);
END $$;

-- 我的认证状态（含最新申请）
CREATE OR REPLACE FUNCTION public.get_my_verification()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.school_verifications%ROWTYPE; v_verified boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT school_verified INTO v_verified FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_row FROM public.school_verifications
    WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'verified', coalesce(v_verified, false),
    'school_id', (SELECT school_id FROM public.profiles WHERE id = v_uid),
    'school', (SELECT school FROM public.profiles WHERE id = v_uid),
    'application', CASE WHEN v_row.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_row.id, 'school_id', v_row.school_id, 'status', v_row.status,
      'reject_reason', v_row.reject_reason, 'created_at', v_row.created_at
    ) END
  );
END $$;

-- 后台：认证申请列表
CREATE OR REPLACE FUNCTION public.list_school_verifications(p_status text DEFAULT 'pending')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id, 'user_id', v.user_id, 'school_id', v.school_id,
    'school', u.name, 'reason', v.reason, 'status', v.status,
    'reject_reason', v.reject_reason, 'created_at', v.created_at,
    'nickname', p.nickname, 'avatar', p.avatar, 'realm', p.realm, 'points', p.points
  ) ORDER BY v.created_at DESC), '[]')
  INTO v_rows
  FROM public.school_verifications v
  JOIN public.universities u ON u.id = v.school_id
  JOIN public.profiles_public p ON p.id = v.user_id
  WHERE v.status = p_status;
  RETURN v_rows;
END $$;

-- 后台：审核认证（通过→写入认证状态；拒绝→记录原因）
CREATE OR REPLACE FUNCTION public.review_school_verification(p_id integer, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin uuid := auth.uid(); v_row public.school_verifications%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT * INTO v_row FROM public.school_verifications WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '申请不存在或已处理'; END IF;
  IF p_approve THEN
    UPDATE public.profiles SET school_verified = true, school_id = v_row.school_id,
           school = (SELECT name FROM public.universities WHERE id = v_row.school_id)
      WHERE id = v_row.user_id;
    -- 撤销该用户其他待审申请
    UPDATE public.school_verifications SET status = 'rejected', reviewed_by = v_admin,
           reviewed_at = now(), reject_reason = '已有认证通过'
      WHERE user_id = v_row.user_id AND id <> p_id AND status = 'pending';
  END IF;
  UPDATE public.school_verifications SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_admin, reviewed_at = now(),
         reject_reason = CASE WHEN p_approve THEN '' ELSE p_reason END
    WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 公开：某校认证修士列表（付费咨询固定格使用）
CREATE OR REPLACE FUNCTION public.list_verified_members(p_school_id integer, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'nickname', nickname, 'avatar', avatar, 'realm', realm,
    'points', points, 'bio', bio
  ) ORDER BY points DESC), '[]')
  INTO v_rows
  FROM public.profiles_public
  WHERE school_id = p_school_id AND school_verified
  LIMIT p_limit;
  RETURN v_rows;
END $$;
