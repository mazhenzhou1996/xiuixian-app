-- 修仙问答 - Supabase 数据库 Schema
-- 在 Supabase Dashboard → SQL Editor 中执行此文件

-- ============ 表结构 ============

-- profiles 表（关联 auth.users）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  nickname TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  realm TEXT DEFAULT 'lianqi',
  points INTEGER DEFAULT 0,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- questions
CREATE TABLE IF NOT EXISTS public.questions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  type TEXT DEFAULT 'normal',
  view_count INTEGER DEFAULT 0,
  hot_score INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- answers
CREATE TABLE IF NOT EXISTS public.answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- comments
CREATE TABLE IF NOT EXISTS public.comments (
  id SERIAL PRIMARY KEY,
  answer_id INTEGER REFERENCES public.answers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to TEXT,
  reply_to_user_id UUID,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- likes
CREATE TABLE IF NOT EXISTS public.likes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- follows
CREATE TABLE IF NOT EXISTS public.follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- read_messages
CREATE TABLE IF NOT EXISTS public.read_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_key TEXT NOT NULL,
  UNIQUE(user_id, message_key)
);

-- ============ 索引 ============
CREATE INDEX IF NOT EXISTS idx_questions_user ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON public.answers(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_answer ON public.comments(answer_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ============ Row Level Security ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_messages ENABLE ROW LEVEL SECURITY;

-- profiles: 所有人可读，只能改自己
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- questions: 所有人可读，登录用户可创建，只能改/删自己的
CREATE POLICY "questions_read" ON public.questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "questions_insert" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "questions_update_own" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "questions_delete_own" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- answers
CREATE POLICY "answers_read" ON public.answers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "answers_insert" ON public.answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "answers_update_own" ON public.answers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "answers_delete_own" ON public.answers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- comments
CREATE POLICY "comments_read" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- likes: 所有人可读，只能操作自己的
CREATE POLICY "likes_read" ON public.likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "likes_insert" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- favorites
CREATE POLICY "favorites_read" ON public.favorites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "favorites_insert" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- follows
CREATE POLICY "follows_read" ON public.follows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- read_messages: 只能读/写自己的
CREATE POLICY "read_messages_read_own" ON public.read_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "read_messages_insert_own" ON public.read_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "read_messages_delete_own" ON public.read_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ PostgreSQL RPC 函数 ============

-- 增加浏览量
CREATE OR REPLACE FUNCTION public.increment_view_count(qid INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.questions SET view_count = view_count + 1 WHERE id = qid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 切换点赞
CREATE OR REPLACE FUNCTION public.toggle_like(t_type TEXT, t_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  existing_id INTEGER;
  uid UUID := auth.uid();
BEGIN
  SELECT id INTO existing_id FROM public.likes WHERE user_id = uid AND target_type = t_type AND target_id = t_id;
  IF existing_id IS NOT NULL THEN
    DELETE FROM public.likes WHERE id = existing_id;
    IF t_type = 'answer' THEN UPDATE public.answers SET like_count = GREATEST(0, like_count - 1) WHERE id = t_id;
    ELSIF t_type = 'question' THEN UPDATE public.questions SET like_count = GREATEST(0, like_count - 1) WHERE id = t_id;
    ELSIF t_type = 'comment' THEN UPDATE public.comments SET like_count = GREATEST(0, like_count - 1) WHERE id = t_id;
    END IF;
    RETURN false;
  ELSE
    INSERT INTO public.likes (user_id, target_type, target_id) VALUES (uid, t_type, t_id);
    IF t_type = 'answer' THEN UPDATE public.answers SET like_count = like_count + 1 WHERE id = t_id;
    ELSIF t_type = 'question' THEN UPDATE public.questions SET like_count = like_count + 1 WHERE id = t_id;
    ELSIF t_type = 'comment' THEN UPDATE public.comments SET like_count = like_count + 1 WHERE id = t_id;
    END IF;
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 切换收藏
CREATE OR REPLACE FUNCTION public.toggle_favorite(q_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  existing_id INTEGER;
  uid UUID := auth.uid();
BEGIN
  SELECT id INTO existing_id FROM public.favorites WHERE user_id = uid AND question_id = q_id;
  IF existing_id IS NOT NULL THEN
    DELETE FROM public.favorites WHERE id = existing_id;
    RETURN false;
  ELSE
    INSERT INTO public.favorites (user_id, question_id) VALUES (uid, q_id);
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 切换关注
CREATE OR REPLACE FUNCTION public.toggle_follow(f_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  existing_id INTEGER;
  uid UUID := auth.uid();
BEGIN
  IF uid = f_id THEN RAISE EXCEPTION '不能关注自己';
  END IF;
  SELECT id INTO existing_id FROM public.follows WHERE follower_id = uid AND following_id = f_id;
  IF existing_id IS NOT NULL THEN
    DELETE FROM public.follows WHERE id = existing_id;
    RETURN false;
  ELSE
    INSERT INTO public.follows (follower_id, following_id) VALUES (uid, f_id);
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加评论并更新计数
CREATE OR REPLACE FUNCTION public.add_comment(a_id INTEGER, c_text TEXT, r_to TEXT, r_to_uid UUID)
RETURNS public.comments AS $$
DECLARE
  new_comment public.comments;
  uid UUID := auth.uid();
BEGIN
  INSERT INTO public.comments (answer_id, user_id, content, reply_to, reply_to_user_id)
  VALUES (a_id, uid, c_text, r_to, r_to_uid)
  RETURNING * INTO new_comment;
  UPDATE public.answers SET comment_count = comment_count + 1 WHERE id = a_id;
  RETURN new_comment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 标记所有消息为已读
CREATE OR REPLACE FUNCTION public.mark_messages_read()
RETURNS void AS $$
DECLARE
  uid UUID := auth.uid();
  f_rec RECORD;
  l_rec RECORD;
  a_rec RECORD;
BEGIN
  FOR f_rec IN SELECT id FROM public.follows WHERE following_id = uid LOOP
    INSERT INTO public.read_messages (user_id, message_key) VALUES (uid, 'follow_' || f_rec.id) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR l_rec IN SELECT l.id FROM public.likes l JOIN public.answers a ON l.target_id = a.id WHERE l.target_type = 'answer' AND a.user_id = uid LOOP
    INSERT INTO public.read_messages (user_id, message_key) VALUES (uid, 'like_' || l_rec.id) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR a_rec IN SELECT a.id FROM public.answers a JOIN public.questions q ON a.question_id = q.id WHERE q.user_id = uid LOOP
    INSERT INTO public.read_messages (user_id, message_key) VALUES (uid, 'answer_' || a_rec.id) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, nickname, avatar, realm, points, bio)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'nickname', '新道友'),
    '',
    COALESCE(NEW.raw_user_meta_data->>'realm', 'lianqi'),
    0,
    ''
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    nickname = EXCLUDED.nickname;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ 种子数据由 seed-supabase.js 脚本导入 ============
