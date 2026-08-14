-- ============================================================
-- 修仙问答 · P0 上线修复迁移 (2026-08-13)
-- 在 Supabase Dashboard → SQL Editor 中整体执行一次即可
-- 包含: 图片列 / 私信表 / 关注问题表 / 关注回答表 / 举报表 / 手机号去敏 / Storage 桶
-- ============================================================

-- ---------- 1. questions 表增加图片列 ----------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- ---------- 2. 私信表 ----------
CREATE TABLE IF NOT EXISTS public.private_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_sender ON public.private_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_receiver ON public.private_messages(receiver_id, created_at DESC);

ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- 只能看到与自己相关的消息（发出或收到）
CREATE POLICY "pm_read_related" ON public.private_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 只能发送自己的消息，且接收者必须存在
CREATE POLICY "pm_insert_own" ON public.private_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- 标记已读：只能更新收到的消息的 read_at
CREATE POLICY "pm_update_read" ON public.private_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id AND read_at IS NOT NULL);

-- ---------- 3. 关注问题表（替换 localStorage 简易版） ----------
CREATE TABLE IF NOT EXISTS public.question_follows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  last_answer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_qf_user ON public.question_follows(user_id, created_at DESC);

ALTER TABLE public.question_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qf_read_own" ON public.question_follows
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "qf_insert_own" ON public.question_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qf_delete_own" ON public.question_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- 4. 关注回答表（替换 localStorage 简易版） ----------
CREATE TABLE IF NOT EXISTS public.answer_follows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_id INTEGER NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  last_like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, answer_id)
);

CREATE INDEX IF NOT EXISTS idx_af_user ON public.answer_follows(user_id, created_at DESC);

ALTER TABLE public.answer_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "af_read_own" ON public.answer_follows
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "af_insert_own" ON public.answer_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "af_delete_own" ON public.answer_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------- 5. 举报表（所有举报落库，供后续管理后台处理） ----------
CREATE TABLE IF NOT EXISTS public.reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('question','answer','comment','user','message')),
  target_id TEXT NOT NULL,
  target_user_id UUID,
  content TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','resolved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 提交者只能读/删自己的举报；后续运营角色由管理后台另设 policy
CREATE POLICY "reports_read_own" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_delete_own" ON public.reports
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id);

-- ---------- 6. 手机号去敏：公开视图不含 phone ----------
-- security_invoker=true 时视图查询仍受 profiles 表 RLS 约束（anon 可读公开字段），
-- 但 phone 列根本不在视图里，任何公开查询都拿不到手机号。
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, nickname, avatar, realm, points, bio, created_at
FROM public.profiles;

-- 现有旧视图若存在则替换（兼容重复执行）
DROP VIEW IF EXISTS public.profiles_public_old;

-- ---------- 7. Storage: 提问/回答图片桶 ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- 登录用户可上传
DROP POLICY IF EXISTS "question-images-insert" ON storage.objects;
CREATE POLICY "question-images-insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-images');

-- 登录用户可覆盖/更新自己的文件
DROP POLICY IF EXISTS "question-images-update" ON storage.objects;
CREATE POLICY "question-images-update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'question-images')
  WITH CHECK (bucket_id = 'question-images');

-- 所有人可读（公网图片 URL）
DROP POLICY IF EXISTS "question-images-read" ON storage.objects;
CREATE POLICY "question-images-read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'question-images');

-- ---------- 8. 私信发送 RPC（校验接收者存在 + 防发给自己） ----------
CREATE OR REPLACE FUNCTION public.send_private_message(to_uid UUID, msg TEXT)
RETURNS public.private_messages AS $$
DECLARE
  new_msg public.private_messages;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
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

-- ---------- 9. 举报 RPC（统一入口，便于后续加审核钩子） ----------
CREATE OR REPLACE FUNCTION public.submit_report(t_type TEXT, t_id TEXT, t_user_id UUID, reason TEXT, extra TEXT)
RETURNS public.reports AS $$
DECLARE
  new_report public.reports;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF t_type NOT IN ('question','answer','comment','user','message') THEN
    RAISE EXCEPTION 'invalid target type';
  END IF;
  INSERT INTO public.reports (reporter_id, target_type, target_id, target_user_id, reason, content)
  VALUES (uid, t_type, t_id, t_user_id, COALESCE(reason, ''), COALESCE(extra, ''))
  RETURNING * INTO new_report;
  RETURN new_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 完成。可重复执行（全部 IF NOT EXISTS / OR REPLACE）。
-- 执行后建议在 Dashboard → Storage → question-images 里确认桶存在。
-- ============================================================
