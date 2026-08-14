-- ============================================================
-- 修仙问答 v12 · 上线差距补齐迁移
-- 执行位置：Supabase Dashboard → SQL Editor 粘贴全部执行
-- 幂等：可重复执行（所有对象均 IF NOT EXISTS / CREATE OR REPLACE）
-- 内容：
--   1) profiles.school 字段（高校下沉市场：本校榜聚合）
--   2) handle_new_user 触发器写入 school
--   3) profiles_public 视图暴露 school
--   4) invite_codes 表 + RLS + 校验/生成函数（邀请制防刷注册闸门）
-- ============================================================

-- ---------- 1. profiles.school ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT DEFAULT '';

-- ---------- 2. 触发器写入 school ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, nickname, avatar, realm, points, bio, school)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'nickname', '新道友'),
    '',
    COALESCE(NEW.raw_user_meta_data->>'realm', 'lianqi'),
    0,
    '',
    COALESCE(NEW.raw_user_meta_data->>'school', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    nickname = EXCLUDED.nickname,
    school = COALESCE(EXCLUDED.school, profiles.school);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 3. profiles_public 视图暴露 school ----------
DROP VIEW IF EXISTS public.profiles_public;
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, nickname, avatar, realm, stage, points, bio, school, created_at
FROM public.profiles;

-- ---------- 4. 邀请码表 ----------
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code TEXT PRIMARY KEY,
  note TEXT DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  used_by UUID,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invite_admin_all" ON public.invite_codes;
CREATE POLICY "invite_admin_all" ON public.invite_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 校验并使用邀请码（原子，避免并发重复用）
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r public.invite_codes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.invite_codes WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF r.used_count >= r.max_uses THEN RETURN FALSE; END IF;
  UPDATE public.invite_codes
    SET used_count = used_count + 1, used_at = NOW(), used_by = auth.uid()
  WHERE code = p_code;
  RETURN TRUE;
END;
$$;

-- 批量生成邀请码（仅管理员）
CREATE OR REPLACE FUNCTION public.generate_invite_codes(
  p_count INTEGER,
  p_note TEXT DEFAULT '',
  p_max_uses INTEGER DEFAULT 1
)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  codes TEXT[] := '{}';
  i INTEGER;
  c TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '无权限';
  END IF;
  FOR i IN 1..p_count LOOP
    c := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    INSERT INTO public.invite_codes (code, note, max_uses, created_by)
    VALUES (c, COALESCE(p_note, ''), p_max_uses, auth.uid())
    ON CONFLICT (code) DO NOTHING;
    codes := codes || c;
  END LOOP;
  RETURN codes;
END;
$$;

-- 预置一批公测邀请码（如不需要可删除此段）
-- INSERT INTO public.invite_codes (code, note, max_uses)
-- VALUES
--   ('XIUXIAN01', '公测批次', 50),
--   ('XIUXIAN02', '公测批次', 50),
--   ('XIUXIAN03', '高校推广', 50)
-- ON CONFLICT (code) DO NOTHING;
