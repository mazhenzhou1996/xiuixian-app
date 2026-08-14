-- ============================================================
-- v13 实时通知全链路
-- 独立 notifications 表 + 触发器（回答/评论/点赞/关注/私信 自动入表）
-- + RPC（拉取/未读计数/已读）+ Realtime 发布
-- 幂等：可重复执行（IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS）
-- 说明：本脚本需在 Supabase SQL Editor（或 psql）执行一次。
--       前端已做降级：未执行本脚本时，通知页/红点回退到旧 getMessages 聚合。
-- ============================================================

-- 1) 通知类型枚举（用 text + check 约束，兼容旧 PG）
CREATE TABLE IF NOT EXISTS public.notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL
              CHECK (type IN ('answer','comment','like','follow','pm','system','invite')),
  actor_id    uuid,                                       -- 触发者
  target_type text,                                       -- question | answer | user | conversation
  target_id   text,                                       -- 跳转用 ID
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  link        text NOT NULL DEFAULT '',                   -- 应用内路由
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- 2) RLS：用户仅能读写自己的通知
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 触发器内部以 SECURITY DEFINER 写入，RLS 不拦截（写入者是系统）
-- 3) 通用插入函数
CREATE OR REPLACE FUNCTION public.fn_insert_notification(
  p_user uuid, p_type text, p_actor uuid, p_target_type text,
  p_target_id text, p_title text, p_body text, p_link text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_user IS NULL OR p_user = p_actor THEN
    -- 不通知自己
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, target_type, target_id, title, body, link)
  VALUES (p_user, p_type, p_actor, p_target_type, p_target_id, p_title, p_body, p_link);
END;
$$;

-- 4) 新回答 → 通知问题主人
CREATE OR REPLACE FUNCTION public.trg_notify_new_answer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  q_owner uuid; q_title text;
BEGIN
  SELECT user_id, title INTO q_owner, q_title FROM public.questions WHERE id = NEW.question_id;
  PERFORM public.fn_insert_notification(
    q_owner, 'answer', NEW.user_id, 'question', NEW.question_id::text,
    '有人回答了你的问题',
    COALESCE(left(NEW.content, 60), ''),
    '/question/' || NEW.question_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_answer ON public.answers;
CREATE TRIGGER trg_notify_new_answer
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_answer();

-- 5) 新评论 → 通知回答主人
CREATE OR REPLACE FUNCTION public.trg_notify_new_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a_owner uuid; a_qid bigint;
BEGIN
  SELECT user_id, question_id INTO a_owner, a_qid FROM public.answers WHERE id = NEW.answer_id;
  PERFORM public.fn_insert_notification(
    a_owner, 'comment', NEW.user_id, 'answer', NEW.answer_id::text,
    '有人评论了你的回答',
    COALESCE(left(NEW.content, 60), ''),
    '/question/' || a_qid
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_comment ON public.comments;
CREATE TRIGGER trg_notify_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_comment();

-- 6) 新点赞（target_type='answer'）→ 通知回答主人
CREATE OR REPLACE FUNCTION public.trg_notify_new_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a_owner uuid; a_qid bigint;
BEGIN
  IF NEW.target_type <> 'answer' THEN RETURN NEW; END IF;
  SELECT user_id, question_id INTO a_owner, a_qid FROM public.answers WHERE id = NEW.target_id;
  PERFORM public.fn_insert_notification(
    a_owner, 'like', NEW.user_id, 'answer', NEW.target_id::text,
    '有人赞了你的回答',
    '',
    '/question/' || a_qid
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_like ON public.likes;
CREATE TRIGGER trg_notify_new_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_like();

-- 7) 新关注 → 通知被关注者
CREATE OR REPLACE FUNCTION public.trg_notify_new_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.fn_insert_notification(
    NEW.following_id, 'follow', NEW.follower_id, 'user', NEW.following_id,
    '有人关注了你',
    '',
    '/user/' || NEW.follower_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_follow ON public.follows;
CREATE TRIGGER trg_notify_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_follow();

-- 8) 新私信 → 通知接收者
CREATE OR REPLACE FUNCTION public.trg_notify_new_pm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.fn_insert_notification(
    NEW.receiver_id, 'pm', NEW.sender_id, 'conversation', NEW.sender_id,
    '收到新私信',
    COALESCE(left(NEW.content, 60), ''),
    '/messages/private/' || NEW.sender_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_pm ON public.private_messages;
CREATE TRIGGER trg_notify_new_pm
  AFTER INSERT ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_pm();

-- 9) RPC：拉取通知
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit int DEFAULT 50)
RETURNS TABLE (
  id bigint, type text, actor_id uuid, target_type text, target_id text,
  title text, body text, link text, read boolean, created_at timestamptz,
  actor_name text, actor_avatar text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.type, n.actor_id, n.target_type, n.target_id,
         n.title, n.body, n.link, n.read, n.created_at,
         p.nickname, p.avatar
  FROM public.notifications n
  LEFT JOIN public.profiles p ON p.id = n.actor_id
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 10) RPC：未读计数
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM public.notifications
  WHERE user_id = auth.uid() AND NOT read;
  RETURN COALESCE(c, 0);
END;
$$;

-- 11) RPC：标记单条已读
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications SET read = true
  WHERE id = p_id AND user_id = auth.uid();
END;
$$;

-- 12) RPC：全部已读
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications SET read = true
  WHERE user_id = auth.uid() AND NOT read;
END;
$$;

-- 13) Realtime：把通知表加入发布（前端订阅 postgres_changes）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
