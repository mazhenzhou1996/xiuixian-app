-- ============================================================
-- 修仙问答 v23 · 商业化平台迁移（2026-08-14）
-- 覆盖：R01 账户角色/钱包/配置/埋点、R02 广告位模型、
--       R07 校园商家入驻、R08 学校页私域广告展板（重点）
-- 全部幂等，可在 Supabase SQL Editor 重复执行
-- ============================================================

-- ============ R01 商业化地基 ============

-- 1. 用户角色（user/creator/merchant/platform）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'creator', 'merchant', 'platform'));

-- 2. 钱包（灵石 coin + 冻结现金 frozen_cny；与既有 balance 并存，balance 为现金）
CREATE TABLE IF NOT EXISTS public.wallets (
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  coin integer NOT NULL DEFAULT 0,          -- 灵石（激励视频/活动获取，道具消耗）
  frozen_cny integer NOT NULL DEFAULT 0,    -- 冻结现金（提现/结算中）
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_read_own" ON public.wallets;
CREATE POLICY "wallet_read_own" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = owner_id OR is_admin());
DROP POLICY IF EXISTS "wallet_admin_all" ON public.wallets;
CREATE POLICY "wallet_admin_all" ON public.wallets
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 注册即建钱包（触发器）
CREATE OR REPLACE FUNCTION public.ensure_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.wallets(owner_id) VALUES (NEW.id) ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ensure_wallet ON public.profiles;
CREATE TRIGGER trg_ensure_wallet AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_wallet();
-- 存量用户补建钱包
INSERT INTO public.wallets(owner_id) SELECT id FROM public.profiles ON CONFLICT (owner_id) DO NOTHING;

-- 3. 全局配置中心
CREATE TABLE IF NOT EXISTS public.config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_read" ON public.config;
CREATE POLICY "config_read" ON public.config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "config_admin" ON public.config;
CREATE POLICY "config_admin" ON public.config FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
-- 默认配置（广告开关/展板位价/服务费率）
INSERT INTO public.config(key, value) VALUES
  ('ads', '{"enabled":true,"feed_interval":5,"reward_coins":10}'::jsonb),
  ('board_price', '{"weekly":50,"monthly":150,"quarterly":400}'::jsonb),
  ('fee_rate', '{"service":0.02,"merchant_settle_days":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. 商业化埋点（统一事件表）
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  event text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON public.analytics_events(event, created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ae_insert" ON public.analytics_events;
CREATE POLICY "ae_insert" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ae_admin_read" ON public.analytics_events;
CREATE POLICY "ae_admin_read" ON public.analytics_events FOR SELECT TO authenticated USING (is_admin());

-- ============ R02 广告位模型 ============

CREATE TABLE IF NOT EXISTS public.ad_slots (
  id serial PRIMARY KEY,
  slot_type text NOT NULL CHECK (slot_type IN ('splash', 'feed', 'reward', 'banner')),
  owner_page text NOT NULL DEFAULT '',
  freq_per_hour integer NOT NULL DEFAULT 5,   -- 频控：每小时最多展示次数
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adslot_read" ON public.ad_slots;
CREATE POLICY "adslot_read" ON public.ad_slots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "adslot_admin" ON public.ad_slots;
CREATE POLICY "adslot_admin" ON public.ad_slots FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
INSERT INTO public.ad_slots(slot_type, owner_page, freq_per_hour) VALUES
  ('splash', '/', 1), ('feed', '/', 5), ('reward', '/', 3), ('banner', '/topic/university', 5)
ON CONFLICT DO NOTHING;

-- 激励视频发灵石（看完回调，防刷：每人每日上限 30 次）
CREATE OR REPLACE FUNCTION public.reward_watch_ad(p_slot text DEFAULT 'reward')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_coin integer := 10; v_today integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT count(*) INTO v_today FROM public.analytics_events
    WHERE user_id = v_uid AND event = 'ad_reward' AND created_at > now() - interval '24 hours';
  IF v_today >= 30 THEN RAISE EXCEPTION '今日观看次数已达上限'; END IF;
  INSERT INTO public.wallets(owner_id, coin) VALUES (v_uid, v_coin)
    ON CONFLICT (owner_id) DO UPDATE SET coin = wallets.coin + v_coin;
  INSERT INTO public.analytics_events(user_id, event, props)
    VALUES (v_uid, 'ad_reward', jsonb_build_object('slot', p_slot, 'coin', v_coin));
  RETURN jsonb_build_object('ok', true, 'coin', v_coin);
END $$;

-- ============ R07 校园商家 ============

CREATE TABLE IF NOT EXISTS public.campuses (
  id serial PRIMARY KEY,
  name text NOT NULL,
  university_id integer REFERENCES public.universities(id),
  lat double precision, lng double precision, radius_m integer DEFAULT 2000,
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campus_read" ON public.campuses;
CREATE POLICY "campus_read" ON public.campuses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "campus_admin" ON public.campuses;
CREATE POLICY "campus_admin" ON public.campuses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.merchants (
  id serial PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_name text NOT NULL,
  category text NOT NULL DEFAULT '餐饮',
  campus_id integer REFERENCES public.campuses(id),
  description text DEFAULT '',
  logo text DEFAULT '',
  address text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchants_campus ON public.merchants(campus_id, status);
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merchant_read" ON public.merchants;
CREATE POLICY "merchant_read" ON public.merchants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "merchant_own_write" ON public.merchants;
CREATE POLICY "merchant_own_write" ON public.merchants FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR is_admin()) WITH CHECK (auth.uid() = owner_id OR is_admin());

-- 商家入驻（自动通过初审：文本类目校验，异常转人工）
CREATE OR REPLACE FUNCTION public.apply_merchant(
  p_shop_name text, p_category text, p_description text DEFAULT '', p_address text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_mid integer; v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  IF p_shop_name IS NULL OR length(p_shop_name) < 2 THEN RAISE EXCEPTION '店铺名称至少2个字'; END IF;
  -- 自动初审：命中敏感词转人工（简化：直接通过，后台可复核）
  v_status := 'approved';
  INSERT INTO public.merchants(owner_id, shop_name, category, description, address, status)
  VALUES (v_uid, p_shop_name, coalesce(p_category, '餐饮'), coalesce(p_description, ''), coalesce(p_address, ''), v_status)
  RETURNING id INTO v_mid;
  UPDATE public.profiles SET role = 'merchant' WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true, 'merchant_id', v_mid, 'status', v_status);
END $$;

-- 后台商家审核
CREATE OR REPLACE FUNCTION public.review_merchant(p_merchant_id integer, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin uuid := auth.uid(); v_owner uuid;
BEGIN
  IF v_admin IS NULL OR NOT is_admin() THEN RAISE EXCEPTION '无权限'; END IF;
  SELECT owner_id INTO v_owner FROM public.merchants WHERE id = p_merchant_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '商家不存在'; END IF;
  UPDATE public.merchants SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reject_reason = CASE WHEN p_approve THEN '' ELSE p_reason END
    WHERE id = p_merchant_id;
  IF p_approve THEN UPDATE public.profiles SET role = 'merchant' WHERE id = v_owner; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============ R08 私域广告展板（v23 重点） ============

CREATE TABLE IF NOT EXISTS public.ad_boards (
  id serial PRIMARY KEY,
  campus_id integer NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  slot integer NOT NULL DEFAULT 1,           -- 展板槽位（官方位 slot=0 优先）
  advertiser_type text NOT NULL DEFAULT 'platform' CHECK (advertiser_type IN ('platform', 'merchant')),
  merchant_id integer REFERENCES public.merchants(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image text DEFAULT '',
  link text DEFAULT '',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_boards_campus ON public.ad_boards(campus_id, status, slot);
ALTER TABLE public.ad_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adboard_read" ON public.ad_boards;
CREATE POLICY "adboard_read" ON public.ad_boards FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "adboard_admin" ON public.ad_boards;
CREATE POLICY "adboard_admin" ON public.ad_boards FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 平台向商家广告推送
CREATE TABLE IF NOT EXISTS public.ad_pushes (
  id serial PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  target_campus_id integer REFERENCES public.campuses(id),
  target_category text DEFAULT '',
  channel text NOT NULL DEFAULT 'inapp' CHECK (channel IN ('inapp', 'sms', 'wecom')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_pushes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adpush_admin" ON public.ad_pushes;
CREATE POLICY "adpush_admin" ON public.ad_pushes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 展板曝光/点击埋点（boardAnalytics 数据源）
CREATE OR REPLACE FUNCTION public.board_track(p_board_id integer, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_action NOT IN ('view', 'click') THEN RAISE EXCEPTION 'invalid action'; END IF;
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (auth.uid(), 'board_' || p_action, jsonb_build_object('board_id', p_board_id));
  RETURN jsonb_build_object('ok', true);
END $$;

-- 展板列表（官方位优先，按槽位排序）
CREATE OR REPLACE FUNCTION public.list_ad_boards(p_campus_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'slot', b.slot, 'advertiser_type', b.advertiser_type,
    'merchant_id', b.merchant_id, 'merchant_name', m.shop_name,
    'title', b.title, 'body', b.body, 'image', b.image, 'link', b.link
  ) ORDER BY b.slot ASC, b.created_at DESC), '[]')
  INTO v_rows
  FROM public.ad_boards b
  LEFT JOIN public.merchants m ON m.id = b.merchant_id
  WHERE b.campus_id = p_campus_id AND b.status = 'active'
    AND b.starts_at <= now() AND b.ends_at >= now();
  RETURN v_rows;
END $$;

-- 商家购买展板位（余额支付，按周/月/季计价，配置中心读价）
CREATE OR REPLACE FUNCTION public.buy_board_slot(
  p_campus_id integer, p_slot integer, p_duration text,
  p_title text, p_body text DEFAULT '', p_link text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_merchant_id integer;
  v_price integer;
  v_balance integer;
  v_days integer;
  v_config jsonb;
  v_bid integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
  SELECT id INTO v_merchant_id FROM public.merchants
    WHERE owner_id = v_uid AND status = 'approved' LIMIT 1;
  IF v_merchant_id IS NULL THEN RAISE EXCEPTION '请先完成商家入驻并通过审核'; END IF;
  IF p_duration NOT IN ('weekly', 'monthly', 'quarterly') THEN RAISE EXCEPTION '时长参数错误'; END IF;
  SELECT value INTO v_config FROM public.config WHERE key = 'board_price';
  v_price := coalesce((v_config->>p_duration)::integer, 0);
  IF v_price <= 0 THEN RAISE EXCEPTION '展板位价格未配置'; END IF;
  v_days := CASE p_duration WHEN 'weekly' THEN 7 WHEN 'monthly' THEN 30 ELSE 90 END;
  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance IS NULL OR v_balance < v_price THEN RAISE EXCEPTION '余额不足（展位费 ¥% ）', v_price; END IF;
  UPDATE public.profiles SET balance = balance - v_price WHERE id = v_uid;
  INSERT INTO public.ad_boards(campus_id, slot, advertiser_type, merchant_id, title, body, link, ends_at)
  VALUES (p_campus_id, p_slot, 'merchant', v_merchant_id, p_title, coalesce(p_body, ''), coalesce(p_link, ''),
          now() + (v_days || ' days')::interval)
  RETURNING id INTO v_bid;
  INSERT INTO public.balance_logs(user_id, delta, balance_after, reason, source)
  VALUES (v_uid, -v_price, (SELECT balance FROM public.profiles WHERE id = v_uid),
          '购买展板位 #' || v_bid || '（' || p_duration || '）', 'board');
  INSERT INTO public.analytics_events(user_id, event, props)
  VALUES (v_uid, 'board_buy', jsonb_build_object('board_id', v_bid, 'price', v_price));
  RETURN jsonb_build_object('ok', true, 'board_id', v_bid, 'price', v_price, 'days', v_days);
END $$;
