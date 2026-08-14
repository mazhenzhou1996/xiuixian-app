-- 修仙问答 · 付费咨询系统迁移 v8 (2026-08-13)
-- 账户余额 / 咨询设置 / 咨询订单 / 金额统计 / 审核退款 RPC
-- 在 Supabase SQL Editor 执行(可重复执行)

-- ---------- 1. 账户余额(单位:元,整数) ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;

-- ---------- 2. 咨询设置(答主定价) ----------
CREATE TABLE IF NOT EXISTS public.consultation_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  price INTEGER DEFAULT 0,                    -- 单次咨询价格(元),0 = 未开通
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_read" ON public.consultation_settings;
CREATE POLICY "cs_read" ON public.consultation_settings
  FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS "cs_own_write" ON public.consultation_settings;
CREATE POLICY "cs_own_write" ON public.consultation_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- 3. 咨询订单 ----------
CREATE TABLE IF NOT EXISTS public.consultations (
  id SERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'answered', 'rejected', 'refunded', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cons_customer ON public.consultations(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cons_expert ON public.consultations(expert_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cons_status ON public.consultations(status);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cons_read_party" ON public.consultations;
CREATE POLICY "cons_read_party" ON public.consultations
  FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = expert_id);
DROP POLICY IF EXISTS "cons_admin_all" ON public.consultations;
CREATE POLICY "cons_admin_all" ON public.consultations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------- 4. 发起咨询 RPC(校验余额并扣款,答主入账) ----------
CREATE OR REPLACE FUNCTION public.create_consultation(p_expert_id UUID, p_question TEXT)
RETURNS public.consultations AS $$
DECLARE
  uid UUID := auth.uid();
  p INTEGER;
  new_c public.consultations;
  my_bal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF uid = p_expert_id THEN RAISE EXCEPTION '不能向自己咨询'; END IF;
  IF p_question IS NULL OR length(btrim(p_question)) < 5 THEN
    RAISE EXCEPTION '咨询内容至少 5 个字';
  END IF;
  SELECT price INTO p FROM public.consultation_settings WHERE user_id = p_expert_id AND enabled = true;
  IF p IS NULL OR p <= 0 THEN RAISE EXCEPTION '对方暂未开通付费咨询'; END IF;
  SELECT balance INTO my_bal FROM public.profiles WHERE id = uid;
  IF my_bal < p THEN RAISE EXCEPTION '余额不足：咨询需 % 元，当前余额 % 元', p, COALESCE(my_bal, 0); END IF;

  UPDATE public.profiles SET balance = balance - p WHERE id = uid;
  UPDATE public.profiles SET balance = balance + p WHERE id = p_expert_id;

  INSERT INTO public.consultations (customer_id, expert_id, price, question)
  VALUES (uid, p_expert_id, p, btrim(p_question))
  RETURNING * INTO new_c;
  RETURN new_c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 5. 答主回复 RPC ----------
CREATE OR REPLACE FUNCTION public.answer_consultation(p_id INTEGER, p_answer TEXT)
RETURNS TEXT AS $$
DECLARE
  uid UUID := auth.uid();
  c public.consultations%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  SELECT * INTO c FROM public.consultations WHERE id = p_id;
  IF c.id IS NULL THEN RAISE EXCEPTION '咨询不存在'; END IF;
  IF c.expert_id <> uid AND NOT is_admin() THEN RAISE EXCEPTION '无权限回复该咨询'; END IF;
  IF c.status <> 'paid' THEN RAISE EXCEPTION '该咨询已处理'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) < 2 THEN RAISE EXCEPTION '回复内容太短'; END IF;
  UPDATE public.consultations
  SET answer = btrim(p_answer), status = 'answered', answered_at = NOW()
  WHERE id = p_id;
  RETURN 'answered';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 6. 退款 RPC(管理员) ----------
CREATE OR REPLACE FUNCTION public.refund_consultation(p_id INTEGER, p_reason TEXT)
RETURNS TEXT AS $$
DECLARE
  c public.consultations%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  SELECT * INTO c FROM public.consultations WHERE id = p_id;
  IF c.id IS NULL THEN RAISE EXCEPTION '咨询不存在'; END IF;
  IF c.status = 'refunded' THEN RAISE EXCEPTION '已退款'; END IF;
  -- 答主扣回,客户退回
  UPDATE public.profiles SET balance = GREATEST(0, balance - c.price) WHERE id = c.expert_id;
  UPDATE public.profiles SET balance = balance + c.price WHERE id = c.customer_id;
  UPDATE public.consultations SET status = 'refunded', answer = COALESCE(answer, '') || E'\n[系统] 已退款：' || COALESCE(p_reason, '')
  WHERE id = p_id;
  RETURN 'refunded';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 7. 我的钱包 RPC(余额 + 收入/支出统计) ----------
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS TABLE (balance INTEGER, income INTEGER, expense INTEGER, consult_count INTEGER, answered_count INTEGER) AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    COALESCE((SELECT balance FROM public.profiles WHERE id = uid), 0),
    COALESCE((SELECT SUM(price) FROM public.consultations WHERE expert_id = uid AND status <> 'refunded'), 0)::int,
    COALESCE((SELECT SUM(price) FROM public.consultations WHERE customer_id = uid AND status <> 'refunded'), 0)::int,
    (SELECT COUNT(*) FROM public.consultations WHERE customer_id = uid)::int,
    (SELECT COUNT(*) FROM public.consultations WHERE expert_id = uid AND status = 'answered')::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 8. 管理员咨询列表 RPC ----------
CREATE OR REPLACE FUNCTION public.admin_list_consultations(p_status TEXT DEFAULT '')
RETURNS TABLE (
  id INTEGER, customer_id UUID, customer_name TEXT, expert_id UUID, expert_name TEXT,
  price INTEGER, question TEXT, answer TEXT, status TEXT, created_at TIMESTAMPTZ, answered_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT c.id, c.customer_id, cp.nickname, c.expert_id, ep.nickname,
         c.price, c.question, c.answer, c.status, c.created_at, c.answered_at
  FROM public.consultations c
  JOIN public.profiles cp ON cp.id = c.customer_id
  JOIN public.profiles ep ON ep.id = c.expert_id
  WHERE p_status = '' OR c.status = p_status
  ORDER BY c.created_at DESC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 修复:举报白名单支持咨询类型
CREATE OR REPLACE FUNCTION public.submit_report(t_type TEXT, t_id TEXT, t_user_id UUID, reason TEXT, extra TEXT)
RETURNS public.reports AS $$
DECLARE
  new_report public.reports;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF t_type NOT IN ('question','answer','comment','user','message','consultation') THEN
    RAISE EXCEPTION 'invalid target type';
  END IF;
  INSERT INTO public.reports (reporter_id, target_type, target_id, target_user_id, reason, content)
  VALUES (uid, t_type, t_id, t_user_id, COALESCE(reason, ''), COALESCE(extra, ''))
  RETURNING * INTO new_report;
  RETURN new_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
