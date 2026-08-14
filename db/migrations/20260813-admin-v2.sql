-- ============================================================
-- 修仙问答 · 管理后台数据层迁移 (2026-08-13)
-- 在 Supabase Dashboard → SQL Editor 整体执行（可重复执行）
-- 包含: 管理员角色 / 高校表 / 九宫格服务表 / 专题配置表 / 变更日志 / 内容下架 / RLS / 回滚 RPC
-- ============================================================

-- ---------- 1. 管理员角色 ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 管理员判断函数（供 RLS / RPC 使用）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 把指定手机号设为管理员（替换成你自己的手机号后执行）
-- UPDATE public.profiles SET is_admin = true WHERE phone = '13800138001';

-- ---------- 2. 内容下架状态 ----------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.answers   ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.comments  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- 旧数据全部视为正常
UPDATE public.questions SET status = 'active' WHERE status IS NULL;
UPDATE public.answers   SET status = 'active' WHERE status IS NULL;
UPDATE public.comments  SET status = 'active' WHERE status IS NULL;

-- ---------- 3. 高校表（全国本科院校） ----------
CREATE TABLE IF NOT EXISTS public.universities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  province TEXT DEFAULT '',
  city TEXT DEFAULT '',
  level TEXT DEFAULT 'other',            -- 985 | 211 | double_first_class | provincial | other
  tags TEXT[] DEFAULT '{}',
  qs TEXT DEFAULT '',
  address TEXT DEFAULT '',
  intro TEXT DEFAULT '',
  pay_text TEXT DEFAULT '付费咨询学长学姐',
  hot_label TEXT DEFAULT '本校热门',
  sort_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uni_name ON public.universities(name);
CREATE INDEX IF NOT EXISTS idx_uni_province ON public.universities(province);
CREATE INDEX IF NOT EXISTS idx_uni_level ON public.universities(level);
CREATE INDEX IF NOT EXISTS idx_uni_enabled ON public.universities(enabled);

-- ---------- 4. 九宫格服务表（可增删改/排序/启停/自定义链接） ----------
CREATE TABLE IF NOT EXISTS public.topic_services (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,                   -- university | graduate | 任意自定义专题名
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'Sparkles',          -- lucide 图标名，见 src/lib/iconMap.ts
  url TEXT DEFAULT '',                   -- 跳转链接（站内 /admin/xxx 或外部 https）
  sort_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic, label)
);

CREATE INDEX IF NOT EXISTS idx_ts_topic ON public.topic_services(topic, sort_order);

-- ---------- 5. 专题配置表（标题/热榜名/咨询文案） ----------
CREATE TABLE IF NOT EXISTS public.topic_configs (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT '',
  hot_label TEXT DEFAULT '',
  pay_text TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 6. 管理员变更日志（回滚依据） ----------
CREATE TABLE IF NOT EXISTS public.admin_change_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,              -- universities | topic_services | topic_configs
  record_id INTEGER NOT NULL,
  action TEXT NOT NULL,                  -- create | update | delete | rollback
  before JSONB,
  after JSONB,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acl_time ON public.admin_change_log(created_at DESC);

-- ============================================================
-- RLS 策略
-- ============================================================

-- universities: 所有人可读（仅 enabled），仅管理员可写
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uni_read" ON public.universities;
CREATE POLICY "uni_read" ON public.universities
  FOR SELECT TO anon, authenticated
  USING (enabled = true);
DROP POLICY IF EXISTS "uni_admin_write" ON public.universities;
CREATE POLICY "uni_admin_write" ON public.universities
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- topic_services: 所有人可读（仅 enabled），仅管理员可写
ALTER TABLE public.topic_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ts_read" ON public.topic_services;
CREATE POLICY "ts_read" ON public.topic_services
  FOR SELECT TO anon, authenticated
  USING (enabled = true);
DROP POLICY IF EXISTS "ts_admin_write" ON public.topic_services;
CREATE POLICY "ts_admin_write" ON public.topic_services
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- topic_configs: 所有人可读，仅管理员可写
ALTER TABLE public.topic_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tc_read" ON public.topic_configs;
CREATE POLICY "tc_read" ON public.topic_configs
  FOR SELECT TO anon, authenticated
  USING (enabled = true);
DROP POLICY IF EXISTS "tc_admin_write" ON public.topic_configs;
CREATE POLICY "tc_admin_write" ON public.topic_configs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- admin_change_log: 仅管理员可读写
ALTER TABLE public.admin_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acl_admin_all" ON public.admin_change_log;
CREATE POLICY "acl_admin_all" ON public.admin_change_log
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- reports: 管理员可读全部、更新状态；普通用户保持原有策略
DROP POLICY IF EXISTS "reports_admin_read" ON public.reports;
CREATE POLICY "reports_admin_read" ON public.reports
  FOR SELECT TO authenticated
  USING (is_admin());
DROP POLICY IF EXISTS "reports_admin_update" ON public.reports;
CREATE POLICY "reports_admin_update" ON public.reports
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- questions/answers/comments: 管理员可改状态（下架/恢复）
DROP POLICY IF EXISTS "questions_admin_status" ON public.questions;
CREATE POLICY "questions_admin_status" ON public.questions
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
DROP POLICY IF EXISTS "answers_admin_status" ON public.answers;
CREATE POLICY "answers_admin_status" ON public.answers
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
DROP POLICY IF EXISTS "comments_admin_status" ON public.comments;
CREATE POLICY "comments_admin_status" ON public.comments
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 普通用户查询内容时排除已下架（RLS 读策略改为仅 active 可见）
DROP POLICY IF EXISTS "questions_read" ON public.questions;
CREATE POLICY "questions_read" ON public.questions
  FOR SELECT TO anon, authenticated
  USING (status = 'active');
DROP POLICY IF EXISTS "answers_read" ON public.answers;
CREATE POLICY "answers_read" ON public.answers
  FOR SELECT TO anon, authenticated
  USING (status = 'active');
DROP POLICY IF EXISTS "comments_read" ON public.comments;
CREATE POLICY "comments_read" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- ============================================================
-- RPC: 一键回滚（按变更日志恢复）
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_rollback(change_id BIGINT)
RETURNS TEXT AS $$
DECLARE
  c admin_change_log%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  SELECT * INTO c FROM public.admin_change_log WHERE id = change_id;
  IF c.id IS NULL THEN RAISE EXCEPTION '变更记录不存在'; END IF;

  IF c.table_name = 'universities' THEN
    IF c.before IS NULL THEN
      -- 原本不存在 → 删除
      DELETE FROM public.universities WHERE id = c.record_id;
    ELSE
      UPDATE public.universities SET
        name = COALESCE(c.before->>'name', name),
        province = COALESCE(c.before->>'province', ''),
        city = COALESCE(c.before->>'city', ''),
        level = COALESCE(c.before->>'level', 'other'),
        tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(c.before->'tags') x), '{}'),
        qs = COALESCE(c.before->>'qs', ''),
        address = COALESCE(c.before->>'address', ''),
        intro = COALESCE(c.before->>'intro', ''),
        pay_text = COALESCE(c.before->>'pay_text', '付费咨询学长学姐'),
        hot_label = COALESCE(c.before->>'hot_label', '本校热门'),
        sort_order = COALESCE((c.before->>'sort_order')::int, 0),
        enabled = COALESCE((c.before->>'enabled')::boolean, true),
        updated_at = NOW()
      WHERE id = c.record_id;
    END IF;
  ELSIF c.table_name = 'topic_services' THEN
    IF c.before IS NULL THEN
      DELETE FROM public.topic_services WHERE id = c.record_id;
    ELSE
      UPDATE public.topic_services SET
        topic = COALESCE(c.before->>'topic', topic),
        label = COALESCE(c.before->>'label', label),
        icon = COALESCE(c.before->>'icon', 'Sparkles'),
        url = COALESCE(c.before->>'url', ''),
        sort_order = COALESCE((c.before->>'sort_order')::int, 0),
        enabled = COALESCE((c.before->>'enabled')::boolean, true)
      WHERE id = c.record_id;
    END IF;
  ELSIF c.table_name = 'topic_configs' THEN
    IF c.before IS NULL THEN
      DELETE FROM public.topic_configs WHERE id = c.record_id;
    ELSE
      UPDATE public.topic_configs SET
        title = COALESCE(c.before->>'title', title),
        hot_label = COALESCE(c.before->>'hot_label', hot_label),
        pay_text = COALESCE(c.before->>'pay_text', pay_text),
        enabled = COALESCE((c.before->>'enabled')::boolean, true),
        updated_at = NOW()
      WHERE id = c.record_id;
    END IF;
  ELSE
    RAISE EXCEPTION '不支持的表格 %', c.table_name;
  END IF;

  INSERT INTO public.admin_change_log (admin_id, table_name, record_id, action, before, after, note)
  VALUES (auth.uid(), c.table_name, c.record_id, 'rollback', jsonb_build_object('orig_change', c.id), c.before, '回滚自变更 #' || c.id);

  RETURN '已回滚变更 #' || c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 初始配置: 九宫格（与现有前台一致，可在后台随意增删改）
-- ============================================================
INSERT INTO public.topic_services (topic, label, icon, url, sort_order, enabled) VALUES
  ('university', '学费查询', 'Coins', '', 1, true),
  ('university', '住宿查询', 'BedDouble', '', 2, true),
  ('university', '奇葩规定', 'AlertTriangle', '', 3, true),
  ('university', '考试真题', 'FileText', '', 4, true),
  ('university', '学霸笔记', 'NotebookPen', '', 5, true),
  ('university', '挂科辅导', 'BookOpenCheck', '', 6, true),
  ('university', '选课指南', 'Compass', '', 7, true),
  ('university', '生活指南', 'LifeBuoy', '', 8, true),
  ('university', '优惠卡券', 'Ticket', '', 9, true),
  ('graduate', '考研择校', 'Compass', '', 1, true),
  ('graduate', '初试复试辅导', 'BookOpenCheck', '', 2, true),
  ('graduate', '专业课真题', 'FileText', '', 3, true),
  ('graduate', '导师选择', 'NotebookPen', '', 4, true),
  ('graduate', '奖励补助', 'Coins', '', 5, true),
  ('graduate', '进面录取', 'Ticket', '', 6, true),
  ('graduate', '住宿查询', 'BedDouble', '', 7, true),
  ('graduate', '奇葩规定', 'AlertTriangle', '', 8, true),
  ('graduate', '生活指南', 'LifeBuoy', '', 9, true)
ON CONFLICT (topic, label) DO NOTHING;

INSERT INTO public.topic_configs (topic, title, hot_label, pay_text, enabled) VALUES
  ('university', '大学专题', '大学热门', '付费咨询学长学姐', true),
  ('graduate', '研究生专题', '研究生热门', '咨询上岸学长学姐', true)
ON CONFLICT (topic) DO NOTHING;

-- ============================================================
-- 完成。下一步:
-- 1. UPDATE profiles SET is_admin = true WHERE phone = '你的手机号';
-- 2. 前端 Admin 后台「高校管理」→ 导入 universities-seed.json
-- ============================================================
