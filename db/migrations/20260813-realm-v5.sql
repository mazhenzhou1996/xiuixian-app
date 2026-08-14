-- ============================================================
-- 修仙问答 · 声望晋级系统迁移 v5 (2026-08-13)
-- 境界等级表 / 晋级申请表 / 声望加分触发器 / 晋级申请与审核 RPC
-- 在 Supabase SQL Editor 执行(可重复执行)
-- ============================================================

-- ---------- 1. 境界阶段列 ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'early';

-- ---------- 2. 境界等级表 ----------
CREATE TABLE IF NOT EXISTS public.realm_levels (
  id SERIAL PRIMARY KEY,
  realm TEXT NOT NULL,
  stage TEXT NOT NULL,
  level_order INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  UNIQUE(realm, stage)
);

ALTER TABLE public.realm_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rl_read" ON public.realm_levels;
CREATE POLICY "rl_read" ON public.realm_levels
  FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS "rl_admin_write" ON public.realm_levels;
CREATE POLICY "rl_admin_write" ON public.realm_levels
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 练气 → 化神 15 个阶段(练气初期 0 声望起步)
INSERT INTO public.realm_levels (realm, stage, level_order, name, min_points) VALUES
  ('lianqi',  'early', 1,  '练气初期', 0),
  ('lianqi',  'mid',   2,  '练气中期', 30),
  ('lianqi',  'late',  3,  '练气后期', 80),
  ('zhuji',   'early', 4,  '筑基初期', 150),
  ('zhuji',   'mid',   5,  '筑基中期', 300),
  ('zhuji',   'late',  6,  '筑基后期', 500),
  ('jiedan',  'early', 7,  '结丹初期', 800),
  ('jiedan',  'mid',   8,  '结丹中期', 1200),
  ('jiedan',  'late',  9,  '结丹后期', 1800),
  ('yuanying','early', 10, '元婴初期', 2500),
  ('yuanying','mid',   11, '元婴中期', 3500),
  ('yuanying','late',  12, '元婴后期', 5000),
  ('huashen', 'early', 13, '化神初期', 7000),
  ('huashen', 'mid',   14, '化神中期', 10000),
  ('huashen', 'late',  15, '化神后期', 15000)
ON CONFLICT (realm, stage) DO UPDATE SET name = EXCLUDED.name, min_points = EXCLUDED.min_points, level_order = EXCLUDED.level_order;

-- ---------- 3. 晋级申请表 ----------
CREATE TABLE IF NOT EXISTS public.promotion_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_realm TEXT NOT NULL,
  from_stage TEXT NOT NULL,
  to_realm TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  to_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reply TEXT DEFAULT '',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pr_user ON public.promotion_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.promotion_requests(status, created_at DESC);

ALTER TABLE public.promotion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pr_read_own" ON public.promotion_requests;
CREATE POLICY "pr_read_own" ON public.promotion_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pr_admin_all" ON public.promotion_requests;
CREATE POLICY "pr_admin_all" ON public.promotion_requests
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------- 4. 声望加分触发器 ----------
-- 公式(声望只增不减，防刷靠唯一约束与运营手段)：
--   提问 +10 | 回答 +20 | 回答被赞 +5 | 问题被收藏 +2 | 被关注 +3

CREATE OR REPLACE FUNCTION public.grant_points_question()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET points = points + 10 WHERE id = NEW.user_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_points_answer()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET points = points + 20 WHERE id = NEW.user_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_points_like()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'answer' THEN
    UPDATE public.profiles SET points = points + 5
      WHERE id = (SELECT user_id FROM public.answers WHERE id = NEW.target_id);
  ELSIF NEW.target_type = 'question' THEN
    UPDATE public.profiles SET points = points + 2
      WHERE id = (SELECT user_id FROM public.questions WHERE id = NEW.target_id);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_points_favorite()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET points = points + 2
    WHERE id = (SELECT user_id FROM public.questions WHERE id = NEW.question_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.grant_points_follow()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET points = points + 3 WHERE id = NEW.following_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_question_points ON public.questions;
CREATE TRIGGER trg_question_points AFTER INSERT ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.grant_points_question();
DROP TRIGGER IF EXISTS trg_answer_points ON public.answers;
CREATE TRIGGER trg_answer_points AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.grant_points_answer();
DROP TRIGGER IF EXISTS trg_like_points ON public.likes;
CREATE TRIGGER trg_like_points AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.grant_points_like();
DROP TRIGGER IF EXISTS trg_favorite_points ON public.favorites;
CREATE TRIGGER trg_favorite_points AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.grant_points_favorite();
DROP TRIGGER IF EXISTS trg_follow_points ON public.follows;
CREATE TRIGGER trg_follow_points AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.grant_points_follow();

-- ---------- 5. 晋级申请 RPC ----------
CREATE OR REPLACE FUNCTION public.apply_promotion()
RETURNS public.promotion_requests AS $$
DECLARE
  uid UUID := auth.uid();
  cur_level public.realm_levels%ROWTYPE;
  next_level public.realm_levels%ROWTYPE;
  my_points INTEGER;
  new_req public.promotion_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  SELECT rl.* INTO cur_level
  FROM public.profiles p
  JOIN public.realm_levels rl ON rl.realm = p.realm AND rl.stage = COALESCE(p.stage, 'early')
  WHERE p.id = uid;
  IF cur_level.id IS NULL THEN RAISE EXCEPTION '当前境界配置不存在，请联系管理员'; END IF;
  SELECT * INTO next_level FROM public.realm_levels WHERE level_order = cur_level.level_order + 1;
  IF next_level.id IS NULL THEN RAISE EXCEPTION '已是最高境界「化神后期」，无需晋级'; END IF;
  SELECT points INTO my_points FROM public.profiles WHERE id = uid;
  IF my_points < next_level.min_points THEN
    RAISE EXCEPTION '声望不足：晋级「%」需 % 点声望，当前 % 点，还差 % 点', next_level.name, next_level.min_points, my_points, next_level.min_points - my_points;
  END IF;
  IF EXISTS (SELECT 1 FROM public.promotion_requests WHERE user_id = uid AND status = 'pending') THEN
    RAISE EXCEPTION '已有待审核的晋级申请，请耐心等待';
  END IF;
  INSERT INTO public.promotion_requests (user_id, from_realm, from_stage, to_realm, to_stage, to_name)
  VALUES (uid, cur_level.realm, cur_level.stage, next_level.realm, next_level.stage, next_level.name)
  RETURNING * INTO new_req;
  RETURN new_req;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 6. 晋级审核 RPC ----------
CREATE OR REPLACE FUNCTION public.admin_review_promotion(p_id BIGINT, p_approve BOOLEAN, p_reply TEXT)
RETURNS TEXT AS $$
DECLARE
  req public.promotion_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  SELECT * INTO req FROM public.promotion_requests WHERE id = p_id;
  IF req.id IS NULL THEN RAISE EXCEPTION '申请不存在'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION '该申请已处理'; END IF;
  IF p_approve THEN
    UPDATE public.profiles SET realm = req.to_realm, stage = req.to_stage
    WHERE id = req.user_id;
  END IF;
  UPDATE public.promotion_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      admin_reply = COALESCE(p_reply, ''),
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_id;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 7. 查询我的晋级状态 RPC ----------
CREATE OR REPLACE FUNCTION public.get_my_promotion()
RETURNS TABLE (current_name TEXT, next_name TEXT, next_min INTEGER, points INTEGER, pending_id BIGINT, pending_to TEXT) AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    (SELECT rl.name FROM public.realm_levels rl WHERE rl.realm = p.realm AND rl.stage = COALESCE(p.stage, 'early')) AS current_name,
    (SELECT rl2.name FROM public.realm_levels rl2 WHERE rl2.level_order = (SELECT rl.level_order FROM public.realm_levels rl WHERE rl.realm = p.realm AND rl.stage = COALESCE(p.stage, 'early')) + 1) AS next_name,
    (SELECT rl2.min_points FROM public.realm_levels rl2 WHERE rl2.level_order = (SELECT rl.level_order FROM public.realm_levels rl WHERE rl.realm = p.realm AND rl.stage = COALESCE(p.stage, 'early')) + 1) AS next_min,
    p.points AS points,
    (SELECT pr.id FROM public.promotion_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending' LIMIT 1) AS pending_id,
    (SELECT pr.to_name FROM public.promotion_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending' LIMIT 1) AS pending_to
  FROM public.profiles p
  WHERE p.id = uid;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
