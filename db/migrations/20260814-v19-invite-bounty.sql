-- ============================================================
-- 修仙问答 v19 · 问题悬赏 + 邀请回答迁移（2026-08-14）
-- 覆盖：问题挂悬赏（提问时/追加）/ 邀请回答（指定用户、批量邀请
--       本校认证修士）/ invites 正式建表 + 通知接入
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. invites 正式建表（含 RLS） ----------
CREATE TABLE IF NOT EXISTS public.invites (
  id SERIAL PRIMARY KEY,
  inviter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_invitee ON public.invites(invitee_id, created_at DESC);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invites_select" ON public.invites;
CREATE POLICY "invites_select" ON public.invites
  FOR SELECT TO authenticated USING (auth.uid() = invitee_id OR auth.uid() = inviter_id OR is_admin());
DROP POLICY IF EXISTS "invites_insert" ON public.invites;
CREATE POLICY "invites_insert" ON public.invites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);

-- ---------- 2. 悬赏关联问题 ----------
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS question_id INTEGER REFERENCES public.questions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bounty_question ON public.bounties(question_id) WHERE question_id IS NOT NULL;

-- ---------- 3. RPC ----------

-- 提问时挂悬赏：余额扣款 + 创建与问题关联的悬赏
CREATE OR REPLACE FUNCTION public.create_bounty_for_question(
  p_question_id integer, p_amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_owner uuid;
  v_title text;
  v_bid integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_amount <= 0 OR p_amount > 100 THEN RAISE EXCEPTION '悬赏金额 1-100 元'; END IF;
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL THEN RAISE EXCEPTION '用户不存在'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION '余额不足'; END IF;
  SELECT user_id, title INTO v_owner, v_title FROM public.questions WHERE id = p_question_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '问题不存在'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION '只能给自己的问题挂悬赏'; END IF;
  IF EXISTS (SELECT 1 FROM public.bounties WHERE question_id = p_question_id AND status = 'open') THEN
    RAISE EXCEPTION '该问题已有进行中的悬赏，请使用追加金额';
  END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_uid;
  INSERT INTO public.bounties(owner_id, question_id, title, content, total_amount)
  VALUES (v_uid, p_question_id, left(v_title, 30), v_title, p_amount)
  RETURNING id INTO v_bid;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -p_amount, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '悬赏问题 #' || p_question_id || '：' || left(v_title, 20), 'bounty');
  RETURN jsonb_build_object('ok', true, 'bounty_id', v_bid);
END $$;

-- 追加悬赏金额（响应慢催更场景）：按问题追加
CREATE OR REPLACE FUNCTION public.add_bounty_amount_by_question(
  p_question_id integer, p_amount integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_bid integer;
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_amount <= 0 OR p_amount > 100 THEN RAISE EXCEPTION '追加金额 1-100 元'; END IF;
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION '余额不足'; END IF;
  SELECT id, owner_id INTO v_bid, v_owner FROM public.bounties
    WHERE question_id = p_question_id AND status = 'open' ORDER BY id LIMIT 1;
  IF v_bid IS NULL THEN
    RETURN public.create_bounty_for_question(p_question_id, p_amount);
  END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION '只能给自己的问题追加悬赏'; END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_uid;
  UPDATE public.bounties SET total_amount = total_amount + p_amount WHERE id = v_bid;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -p_amount, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '追加悬赏 #' || v_bid || '（问题 #' || p_question_id || '）', 'bounty');
  RETURN jsonb_build_object('ok', true, 'bounty_id', v_bid, 'added', p_amount);
END $$;

-- 邀请指定用户回答（写 invites + 通知）
CREATE OR REPLACE FUNCTION public.invite_user(p_question_id integer, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION '不能邀请自己'; END IF;
  SELECT title INTO v_title FROM public.questions WHERE id = p_question_id;
  IF v_title IS NULL THEN RAISE EXCEPTION '问题不存在'; END IF;
  IF EXISTS (SELECT 1 FROM public.invites WHERE inviter_id = v_uid AND invitee_id = p_user_id AND question_id = p_question_id) THEN
    RAISE EXCEPTION '已邀请过该用户';
  END IF;
  INSERT INTO public.invites(inviter_id, invitee_id, question_id) VALUES (v_uid, p_user_id, p_question_id);
  PERFORM public.fn_insert_notification(
    p_user_id, 'invite', v_uid, 'question', p_question_id::text,
    '邀请你回答问题', '你被邀请回答：' || left(v_title, 30), '/question/' || p_question_id
  );
  RETURN jsonb_build_object('ok', true);
END $$;

-- 批量邀请本校认证修士（选校确认推送）
CREATE OR REPLACE FUNCTION public.invite_verified_members(p_question_id integer, p_school_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_title text;
  v_count integer := 0;
  v_member record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT title INTO v_title FROM public.questions WHERE id = p_question_id;
  IF v_title IS NULL THEN RAISE EXCEPTION '问题不存在'; END IF;
  FOR v_member IN
    SELECT id FROM public.profiles_public
    WHERE school_id = p_school_id AND school_verified
      AND id <> v_uid
    LIMIT 50
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.invites
                   WHERE inviter_id = v_uid AND invitee_id = v_member.id AND question_id = p_question_id) THEN
      INSERT INTO public.invites(inviter_id, invitee_id, question_id) VALUES (v_uid, v_member.id, p_question_id);
      PERFORM public.fn_insert_notification(
        v_member.id, 'invite', v_uid, 'question', p_question_id::text,
        '本校认证修士邀请', '同校道友邀请你回答：' || left(v_title, 30), '/question/' || p_question_id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'invited', v_count);
END $$;

-- 我收到的邀请列表（含问题信息）
CREATE OR REPLACE FUNCTION public.list_my_invites(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'question_id', i.question_id, 'q_title', q.title,
    'inviter', p.nickname, 'inviter_avatar', p.avatar,
    'is_verified', coalesce(p.school_verified, false),
    'created_at', i.created_at
  ) ORDER BY i.created_at DESC), '[]')
  INTO v_rows
  FROM public.invites i
  JOIN public.questions q ON q.id = i.question_id
  JOIN public.profiles_public p ON p.id = i.inviter_id
  WHERE i.invitee_id = v_uid
  LIMIT p_limit;
  RETURN v_rows;
END $$;
