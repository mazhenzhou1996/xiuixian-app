-- 修仙问答 · 悬赏榜系统迁移 v9 (2026-08-14)
-- 悬赏 / 悬赏回复 / 追加赏金 / 认可分红 / 自动生成问题 / 悬赏金排名

CREATE TABLE IF NOT EXISTS public.bounties (
  id SERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_consultation_id INTEGER REFERENCES public.consultations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'closed')),
  accepted_answer_id INTEGER,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bounty_status ON public.bounties(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounty_owner ON public.bounties(owner_id);

CREATE TABLE IF NOT EXISTS public.bounty_answers (
  id SERIAL PRIMARY KEY,
  bounty_id INTEGER NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  payout_amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ba_bounty ON public.bounty_answers(bounty_id, created_at);

ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bounty_read" ON public.bounties;
CREATE POLICY "bounty_read" ON public.bounties FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bounty_owner_write" ON public.bounties;
CREATE POLICY "bounty_owner_write" ON public.bounties FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "bounty_admin_all" ON public.bounties;
CREATE POLICY "bounty_admin_all" ON public.bounties FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE public.bounty_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ba_read" ON public.bounty_answers;
CREATE POLICY "ba_read" ON public.bounty_answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ba_insert" ON public.bounty_answers;
CREATE POLICY "ba_insert" ON public.bounty_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ba_update" ON public.bounty_answers;
CREATE POLICY "ba_update" ON public.bounty_answers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.create_bounty_from_consultation(p_cid INTEGER)
RETURNS public.bounties AS $$
DECLARE
  uid UUID := auth.uid();
  c public.consultations%ROWTYPE;
  new_b public.bounties;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  SELECT * INTO c FROM public.consultations WHERE id = p_cid;
  IF c.id IS NULL THEN RAISE EXCEPTION '咨询不存在'; END IF;
  IF c.customer_id <> uid THEN RAISE EXCEPTION '无权操作该咨询'; END IF;
  IF c.status <> 'refunded' THEN RAISE EXCEPTION '仅已退款（投诉通过）的咨询可释放到悬赏榜'; END IF;
  IF EXISTS (SELECT 1 FROM public.bounties WHERE source_consultation_id = p_cid) THEN
    RAISE EXCEPTION '该咨询已释放到悬赏榜';
  END IF;
  INSERT INTO public.bounties (owner_id, source_consultation_id, title, content, total_amount)
  VALUES (uid, p_cid, left(btrim(c.question), 30), btrim(c.question), 0)
  RETURNING * INTO new_b;
  RETURN new_b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_bounty_money(p_bid INTEGER, p_amount INTEGER)
RETURNS public.bounties AS $$
DECLARE
  uid UUID := auth.uid();
  b public.bounties%ROWTYPE;
  bal INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF p_amount < 1 OR p_amount > 10000 THEN RAISE EXCEPTION '追加金额需在 1-10000 元之间'; END IF;
  SELECT * INTO b FROM public.bounties WHERE id = p_bid;
  IF b.id IS NULL THEN RAISE EXCEPTION '悬赏不存在'; END IF;
  IF b.owner_id <> uid THEN RAISE EXCEPTION '只有悬赏人可以追加悬赏金'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION '悬赏已结束'; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = uid;
  IF bal < p_amount THEN RAISE EXCEPTION '余额不足：当前 % 元，需 % 元', COALESCE(bal, 0), p_amount; END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = uid;
  UPDATE public.bounties SET total_amount = total_amount + p_amount WHERE id = p_bid
  RETURNING * INTO b;
  RETURN b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.answer_bounty(p_bid INTEGER, p_content TEXT)
RETURNS public.bounty_answers AS $$
DECLARE
  uid UUID := auth.uid();
  b public.bounties%ROWTYPE;
  new_a public.bounty_answers;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF p_content IS NULL OR length(btrim(p_content)) < 5 THEN RAISE EXCEPTION '回复至少 5 个字'; END IF;
  SELECT * INTO b FROM public.bounties WHERE id = p_bid;
  IF b.id IS NULL THEN RAISE EXCEPTION '悬赏不存在'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION '悬赏已结束'; END IF;
  IF b.owner_id = uid THEN RAISE EXCEPTION '不能回复自己的悬赏'; END IF;
  INSERT INTO public.bounty_answers (bounty_id, user_id, content)
  VALUES (p_bid, uid, btrim(p_content))
  RETURNING * INTO new_a;
  RETURN new_a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.accept_bounty_answer(p_bid INTEGER, p_aid INTEGER)
RETURNS JSONB AS $$
DECLARE
  uid UUID := auth.uid();
  b public.bounties%ROWTYPE;
  a public.bounty_answers%ROWTYPE;
  others_total INTEGER := 0;
  others_count INTEGER := 0;
  share_pool INTEGER;
  i RECORD;
  new_q questions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  SELECT * INTO b FROM public.bounties WHERE id = p_bid;
  IF b.id IS NULL THEN RAISE EXCEPTION '悬赏不存在'; END IF;
  IF b.owner_id <> uid THEN RAISE EXCEPTION '只有悬赏人可以认可答案'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION '悬赏已结束'; END IF;
  SELECT * INTO a FROM public.bounty_answers WHERE id = p_aid AND bounty_id = p_bid;
  IF a.id IS NULL THEN RAISE EXCEPTION '回复不存在'; END IF;

  UPDATE public.bounty_answers SET status = 'accepted', payout_amount = (b.total_amount * 70) / 100 WHERE id = p_aid;
  UPDATE public.profiles SET balance = balance + (b.total_amount * 70) / 100 WHERE id = a.user_id;

  share_pool := b.total_amount - (b.total_amount * 70) / 100;
  SELECT COALESCE(SUM(like_count), 0), COUNT(*) INTO others_total, others_count
  FROM public.bounty_answers WHERE bounty_id = p_bid AND id <> p_aid AND status = 'pending';
  IF others_count > 0 THEN
    FOR i IN SELECT id, user_id, like_count FROM public.bounty_answers
             WHERE bounty_id = p_bid AND id <> p_aid AND status = 'pending' LOOP
      DECLARE
        share INTEGER;
      BEGIN
        IF others_total > 0 THEN
          share := (share_pool * i.like_count) / others_total;
        ELSE
          share := share_pool / others_count;
        END IF;
        UPDATE public.bounty_answers SET status = 'rejected', payout_amount = share WHERE id = i.id;
        IF share > 0 THEN
          UPDATE public.profiles SET balance = balance + share WHERE id = i.user_id;
        END IF;
      END;
    END LOOP;
  END IF;

  INSERT INTO public.questions (user_id, title, content, type, hot_score)
  VALUES (uid, b.title, b.content || E'\n\n[悬赏答疑] 已由悬赏人认可最佳回答。', 'normal', GREATEST(b.total_amount, 1))
  RETURNING * INTO new_q;

  UPDATE public.bounties SET status = 'accepted', accepted_answer_id = p_aid, accepted_at = NOW()
  WHERE id = p_bid;

  RETURN jsonb_build_object('question_id', new_q.id, 'accepted_payout', (b.total_amount * 70) / 100, 'share_pool', share_pool);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_bounty_rankings()
RETURNS TABLE (user_id UUID, nickname TEXT, total_payout INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT ba.user_id, p.nickname, SUM(ba.payout_amount)::int AS total_payout
  FROM public.bounty_answers ba
  JOIN public.profiles p ON p.id = ba.user_id
  WHERE ba.status = 'accepted'
  GROUP BY ba.user_id, p.nickname
  ORDER BY total_payout DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.like_bounty_answer(p_aid INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not logged in'; END IF;
  IF EXISTS (SELECT 1 FROM public.likes WHERE user_id = uid AND target_type = 'bounty_answer' AND target_id = p_aid) THEN
    DELETE FROM public.likes WHERE user_id = uid AND target_type = 'bounty_answer' AND target_id = p_aid;
    UPDATE public.bounty_answers SET like_count = GREATEST(0, like_count - 1) WHERE id = p_aid;
    RETURN false;
  END IF;
  INSERT INTO public.likes (user_id, target_type, target_id) VALUES (uid, 'bounty_answer', p_aid);
  UPDATE public.bounty_answers SET like_count = like_count + 1 WHERE id = p_aid;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
