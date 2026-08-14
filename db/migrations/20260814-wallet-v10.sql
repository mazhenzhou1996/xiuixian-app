-- 修仙问答 · 赏金与回收箱系统迁移 v10 (2026-08-14)
-- 悬赏隐藏/软删 / 签到得赏金(连签福利,封顶100) / 余额流水 / 后台发放与去除

ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.checkins (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak INTEGER DEFAULT 1,
  reward INTEGER DEFAULT 0,
  UNIQUE(user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id, checkin_date DESC);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ck_own" ON public.checkins;
CREATE POLICY "ck_own" ON public.checkins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.balance_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bl_user ON public.balance_logs(user_id, created_at DESC);
ALTER TABLE public.balance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bl_read_own" ON public.balance_logs;
CREATE POLICY "bl_read_own" ON public.balance_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bl_admin_all" ON public.balance_logs;
CREATE POLICY "bl_admin_all" ON public.balance_logs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION public.balance_cap()
RETURNS INTEGER AS $$ SELECT 100 $$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.checkin()
RETURNS JSONB AS $$
DECLARE
  uid UUID := auth.uid();
  yesterday DATE := CURRENT_DATE - 1;
  last_ck checkins%ROWTYPE;
  new_streak INTEGER := 1;
  reward INTEGER := 1;
  bal INTEGER;
  new_bal INTEGER;
  actual INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF EXISTS (SELECT 1 FROM public.checkins WHERE user_id = uid AND checkin_date = CURRENT_DATE) THEN
    RAISE EXCEPTION '今天已签到';
  END IF;
  SELECT * INTO last_ck FROM public.checkins WHERE user_id = uid AND checkin_date = yesterday;
  IF last_ck.id IS NOT NULL THEN new_streak := last_ck.streak + 1; END IF;
  IF new_streak >= 30 THEN reward := 10;
  ELSIF new_streak >= 14 THEN reward := 5;
  ELSIF new_streak >= 7 THEN reward := 3;
  ELSIF new_streak >= 3 THEN reward := 2;
  ELSE reward := 1;
  END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = uid;
  new_bal := LEAST(balance_cap(), COALESCE(bal, 0) + reward);
  actual := new_bal - COALESCE(bal, 0);
  IF actual > 0 THEN
    UPDATE public.profiles SET balance = new_bal WHERE id = uid;
  END IF;
  INSERT INTO public.checkins (user_id, checkin_date, streak, reward)
  VALUES (uid, CURRENT_DATE, new_streak, actual);
  INSERT INTO public.balance_logs (user_id, delta, balance_after, reason, source)
  VALUES (uid, actual, new_bal, '签到奖励（连签 ' || new_streak || ' 天）', 'checkin');
  RETURN jsonb_build_object('streak', new_streak, 'reward', actual, 'balance', new_bal, 'capped', actual < reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_checkin()
RETURNS TABLE (checked_today BOOLEAN, streak INTEGER, balance INTEGER, total_reward INTEGER) AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    EXISTS (SELECT 1 FROM public.checkins WHERE user_id = uid AND checkin_date = CURRENT_DATE),
    COALESCE((SELECT streak FROM public.checkins WHERE user_id = uid ORDER BY checkin_date DESC LIMIT 1), 0),
    COALESCE((SELECT balance FROM public.profiles WHERE id = uid), 0),
    COALESCE((SELECT SUM(reward) FROM public.checkins WHERE user_id = uid), 0)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_balance_logs()
RETURNS TABLE (delta INTEGER, balance_after INTEGER, reason TEXT, source TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT bl.delta, bl.balance_after, bl.reason, bl.source, bl.created_at
  FROM public.balance_logs bl
  WHERE bl.user_id = uid
  ORDER BY bl.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.hide_bounty(p_bid INTEGER)
RETURNS TEXT AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  UPDATE public.bounties SET hidden = true WHERE id = p_bid AND owner_id = uid;
  RETURN 'hidden';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unhide_bounty(p_bid INTEGER)
RETURNS TEXT AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  UPDATE public.bounties SET hidden = false WHERE id = p_bid AND owner_id = uid;
  RETURN 'unhidden';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_bounty(p_bid INTEGER)
RETURNS TEXT AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  UPDATE public.bounties SET deleted = true, deleted_at = NOW() WHERE id = p_bid AND owner_id = uid;
  RETURN 'deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_bounty(p_bid INTEGER)
RETURNS TEXT AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  UPDATE public.bounties SET deleted = false, deleted_at = NULL WHERE id = p_bid AND owner_id = uid;
  RETURN 'restored';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_grant_balance(p_uid UUID, p_amount INTEGER, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  bal INTEGER;
  new_bal INTEGER;
  actual INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  IF p_amount = 0 THEN RAISE EXCEPTION '金额不能为 0'; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = p_uid;
  new_bal := GREATEST(0, LEAST(balance_cap(), COALESCE(bal, 0) + p_amount));
  actual := new_bal - COALESCE(bal, 0);
  UPDATE public.profiles SET balance = new_bal WHERE id = p_uid;
  INSERT INTO public.balance_logs (user_id, delta, balance_after, reason, source)
  VALUES (p_uid, actual, new_bal, '管理员' || CASE WHEN actual >= 0 THEN '发放' ELSE '去除' END || '：' || COALESCE(p_reason, ''), 'admin');
  RETURN jsonb_build_object('balance', new_bal, 'delta', actual);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_balance_logs(p_uid UUID)
RETURNS TABLE (id BIGINT, delta INTEGER, balance_after INTEGER, reason TEXT, source TEXT, created_at TIMESTAMPTZ, abnormal BOOLEAN) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT bl.id, bl.delta, bl.balance_after, bl.reason, bl.source, bl.created_at,
         (abs(bl.delta) > 50 OR bl.balance_after <= 0) AS abnormal
  FROM public.balance_logs bl
  WHERE bl.user_id = p_uid
  ORDER BY bl.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
