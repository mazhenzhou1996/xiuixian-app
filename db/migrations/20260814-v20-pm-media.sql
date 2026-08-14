-- ============================================================
-- 修仙问答 v20 · 私信图片/视频迁移（2026-08-14）
-- 覆盖：private_messages.msg_type（text/image/video）、
--       send_private_message RPC 支持消息类型
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ---------- 1. 消息类型字段 ----------
ALTER TABLE public.private_messages ADD COLUMN IF NOT EXISTS msg_type text NOT NULL DEFAULT 'text'
  CHECK (msg_type IN ('text', 'image', 'video'));

-- ---------- 2. 发送 RPC 支持类型（旧调用不传 p_type 默认 text，完全兼容） ----------
CREATE OR REPLACE FUNCTION public.send_private_message(
  to_uid uuid,
  msg text,
  p_type text DEFAULT 'text'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid := auth.uid();
  nw public.private_messages%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF uid = to_uid THEN RAISE EXCEPTION '不能给自己发消息'; END IF;
  IF p_type NOT IN ('text', 'image', 'video') THEN RAISE EXCEPTION 'invalid message type'; END IF;
  -- 禁言校验（与既有惩罚体系一致）
  IF EXISTS (SELECT 1 FROM public.user_penalties
             WHERE user_id = uid AND type = 'mute' AND (until IS NULL OR until > now())) THEN
    RAISE EXCEPTION '账号已被禁言，无法发送消息';
  END IF;
  INSERT INTO public.private_messages(sender_id, receiver_id, content, msg_type)
  VALUES (uid, to_uid, msg, p_type)
  RETURNING * INTO nw;
  RETURN jsonb_build_object(
    'id', nw.id, 'sender_id', nw.sender_id, 'receiver_id', nw.receiver_id,
    'content', nw.content, 'msg_type', nw.msg_type, 'created_at', nw.created_at
  );
END $$;

-- ---------- 3. 通知触发器透传类型（v13 触发器读取 content；视频/图片消息通知文案不变，兼容） ----------
-- 无需改动：trg_notify_new_pm 读 NEW.content 与 NEW.sender_id，类型字段不影响
