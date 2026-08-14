-- ============================================================
-- 修仙问答 · 管理后台增强迁移 v3 (2026-08-13)
-- 用户惩罚(禁言/封禁) / 运营公告 / 内容真删除 / 权限校验 RPC
-- 在 Supabase SQL Editor 执行(可重复执行)
-- ============================================================

-- ---------- 1. 用户惩罚表 ----------
CREATE TABLE IF NOT EXISTS public.user_penalties (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mute', 'ban')),
  reason TEXT DEFAULT '',
  -- mute: 禁言时长(小时), 0 = 永久禁言
  duration_hours INTEGER DEFAULT 24,
  -- ban: 封禁到期时间, NULL = 永久封禁
  until TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_up_user ON public.user_penalties(user_id, status);
CREATE INDEX IF NOT EXISTS idx_up_status ON public.user_penalties(status);

ALTER TABLE public.user_penalties ENABLE ROW LEVEL SECURITY;

-- 管理员可读写全部；用户只能看自己的惩罚记录
DROP POLICY IF EXISTS "up_admin_all" ON public.user_penalties;
CREATE POLICY "up_admin_all" ON public.user_penalties
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
DROP POLICY IF EXISTS "up_read_own" ON public.user_penalties;
CREATE POLICY "up_read_own" ON public.user_penalties
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------- 2. 运营公告表 ----------
CREATE TABLE IF NOT EXISTS public.announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ann_enabled ON public.announcements(enabled, created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 前台可读已启用的公告；管理员可读写全部
DROP POLICY IF EXISTS "ann_read" ON public.announcements;
CREATE POLICY "ann_read" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (enabled = true OR is_admin());
DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements;
CREATE POLICY "ann_admin_all" ON public.announcements
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------- 3. 内容真删除：管理员可删除任何内容 ----------
DROP POLICY IF EXISTS "questions_admin_delete" ON public.questions;
CREATE POLICY "questions_admin_delete" ON public.questions
  FOR DELETE TO authenticated
  USING (is_admin());
DROP POLICY IF EXISTS "answers_admin_delete" ON public.answers;
CREATE POLICY "answers_admin_delete" ON public.answers
  FOR DELETE TO authenticated
  USING (is_admin());
DROP POLICY IF EXISTS "comments_admin_delete" ON public.comments;
CREATE POLICY "comments_admin_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (is_admin());

-- 内容删除时级联清理关联数据(点赞/收藏/关注/评论/举报)
CREATE OR REPLACE FUNCTION public.admin_delete_content(t_type TEXT, t_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  IF t_type = 'question' THEN
    DELETE FROM public.likes WHERE target_type = 'question' AND target_id = t_id;
    DELETE FROM public.favorites WHERE question_id = t_id;
    DELETE FROM public.question_follows WHERE question_id = t_id;
    DELETE FROM public.answers WHERE question_id = t_id;
    DELETE FROM public.questions WHERE id = t_id;
  ELSIF t_type = 'answer' THEN
    DELETE FROM public.likes WHERE target_type = 'answer' AND target_id = t_id;
    DELETE FROM public.answer_follows WHERE answer_id = t_id;
    DELETE FROM public.comments WHERE answer_id = t_id;
    DELETE FROM public.answers WHERE id = t_id;
  ELSIF t_type = 'comment' THEN
    DELETE FROM public.likes WHERE target_type = 'comment' AND target_id = t_id;
    DELETE FROM public.comments WHERE id = t_id;
  ELSE
    RAISE EXCEPTION '不支持的类型 %', t_type;
  END IF;
  DELETE FROM public.reports WHERE target_type = t_type AND target_id = t_id::text;
  RETURN 'deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 4. 用户惩罚 RPC ----------
-- 施加惩罚(禁言/封禁)
CREATE OR REPLACE FUNCTION public.admin_penalize_user(p_uid UUID, p_type TEXT, p_duration_hours INTEGER, p_until TIMESTAMPTZ, p_reason TEXT)
RETURNS public.user_penalties AS $$
DECLARE
  new_p user_penalties;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  IF p_type NOT IN ('mute', 'ban') THEN RAISE EXCEPTION '类型错误'; END IF;
  IF p_uid = auth.uid() THEN RAISE EXCEPTION '不能惩罚自己'; END IF;
  -- 先撤销该用户所有生效中的惩罚
  UPDATE public.user_penalties SET status = 'revoked'
    WHERE user_id = p_uid AND status = 'active';
  INSERT INTO public.user_penalties (user_id, type, duration_hours, until, reason, created_by)
  VALUES (p_uid, p_type, COALESCE(p_duration_hours, 24), p_until, COALESCE(p_reason, ''), auth.uid())
  RETURNING * INTO new_p;
  RETURN new_p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 撤销惩罚(解封/解禁)
CREATE OR REPLACE FUNCTION public.admin_revoke_penalty(p_id BIGINT)
RETURNS TEXT AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  UPDATE public.user_penalties SET status = 'revoked' WHERE id = p_id AND status = 'active';
  RETURN 'revoked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 查询用户当前生效的惩罚(写操作前校验用)
CREATE OR REPLACE FUNCTION public.get_my_penalty()
RETURNS public.user_penalties AS $$
DECLARE
  p user_penalties;
BEGIN
  SELECT * INTO p FROM public.user_penalties
    WHERE user_id = auth.uid() AND status = 'active'
      AND (until IS NULL OR until > NOW())
    ORDER BY id DESC LIMIT 1;
  RETURN p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 私信发送时校验惩罚
CREATE OR REPLACE FUNCTION public.send_private_message(to_uid UUID, msg TEXT)
RETURNS public.private_messages AS $$
DECLARE
  new_msg public.private_messages;
  uid UUID := auth.uid();
  p user_penalties;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  SELECT * INTO p FROM public.user_penalties
    WHERE user_id = uid AND status = 'active' AND (until IS NULL OR until > NOW())
    ORDER BY id DESC LIMIT 1;
  IF p.id IS NOT NULL THEN
    IF p.type = 'mute' THEN RAISE EXCEPTION '账号已被禁言，无法发送私信';
    ELSE RAISE EXCEPTION '账号已被封禁';
    END IF;
  END IF;
  IF to_uid = uid THEN RAISE EXCEPTION '不能给自己发私信'; END IF;
  IF msg IS NULL OR length(btrim(msg)) = 0 THEN RAISE EXCEPTION '消息不能为空'; END IF;
  IF length(msg) > 2000 THEN RAISE EXCEPTION '消息过长'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = to_uid) THEN
    RAISE EXCEPTION '接收者不存在';
  END IF;
  INSERT INTO public.private_messages (sender_id, receiver_id, content)
  VALUES (uid, to_uid, btrim(msg))
  RETURNING * INTO new_msg;
  RETURN new_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 自动清理过期惩罚(定时任务可选,查询时已过滤 until > NOW())
CREATE OR REPLACE FUNCTION public.expire_penalties()
RETURNS void AS $$
BEGIN
  UPDATE public.user_penalties SET status = 'expired'
    WHERE status = 'active' AND until IS NOT NULL AND until <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理员视角:查询用户 + 当前生效惩罚
CREATE OR REPLACE FUNCTION public.admin_list_users(kw TEXT DEFAULT '')
RETURNS TABLE (
  id UUID, phone TEXT, nickname TEXT, avatar TEXT, realm TEXT, points INTEGER,
  is_admin BOOLEAN, created_at TIMESTAMPTZ,
  penalty_type TEXT, penalty_until TIMESTAMPTZ, penalty_reason TEXT, penalty_id BIGINT
) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT p.id, p.phone, p.nickname, p.avatar, p.realm, p.points, p.is_admin, p.created_at,
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

-- 管理员视角:某用户全部惩罚历史
CREATE OR REPLACE FUNCTION public.admin_list_penalties(p_uid UUID)
RETURNS TABLE (id BIGINT, type TEXT, reason TEXT, duration_hours INTEGER, until TIMESTAMPTZ, status TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT up.id, up.type, up.reason, up.duration_hours, up.until, up.status, up.created_at
  FROM public.user_penalties up
  WHERE up.user_id = p_uid
  ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
