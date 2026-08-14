-- 修仙问答 · 高校服务内容迁移 v7 (2026-08-13)
-- 每所高校 × 每个九宫格服务项 = 独立内容(文字 + 网盘附件)
-- 在 Supabase SQL Editor 执行(可重复执行)

CREATE TABLE IF NOT EXISTS public.service_contents (
  id SERIAL PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES public.topic_services(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  netdisk_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_sc_uni ON public.service_contents(university_id);
CREATE INDEX IF NOT EXISTS idx_sc_svc ON public.service_contents(service_id);

ALTER TABLE public.service_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sc_read" ON public.service_contents;
CREATE POLICY "sc_read" ON public.service_contents
  FOR SELECT TO anon, authenticated
  USING (true);
DROP POLICY IF EXISTS "sc_admin_all" ON public.service_contents;
CREATE POLICY "sc_admin_all" ON public.service_contents
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 批量导入 RPC:按 高校名+服务名 匹配 upsert(不存在则插入)
CREATE OR REPLACE FUNCTION public.admin_bulk_import_contents(rows JSONB)
RETURNS JSONB AS $$
DECLARE
  item JSONB;
  uni_id INTEGER;
  svc_id INTEGER;
  added INTEGER := 0;
  updated INTEGER := 0;
  failed INTEGER := 0;
  errs TEXT[] := '{}';
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(rows) LOOP
    BEGIN
      SELECT id INTO uni_id FROM public.universities WHERE name = item->>'university';
      IF uni_id IS NULL THEN
        failed := failed + 1;
        errs := errs || (item->>'university' || ': 高校不存在');
        CONTINUE;
      END IF;
      SELECT id INTO svc_id FROM public.topic_services WHERE label = item->>'service' AND topic = COALESCE(item->>'topic', 'university');
      IF svc_id IS NULL THEN
        failed := failed + 1;
        errs := errs || ((item->>'service') || ': 服务不存在');
        CONTINUE;
      END IF;
      INSERT INTO public.service_contents (university_id, service_id, content, netdisk_url, updated_at)
      VALUES (uni_id, svc_id, COALESCE(item->>'content', ''), COALESCE(item->>'netdisk_url', ''), NOW())
      ON CONFLICT (university_id, service_id)
      DO UPDATE SET content = EXCLUDED.content, netdisk_url = EXCLUDED.netdisk_url, updated_at = NOW();
      IF FOUND THEN updated := updated + 1; ELSE added := added + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      errs := errs || ((item->>'university') || '/' || (item->>'service') || ': ' || SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('added', added, 'updated', updated, 'failed', failed, 'errors', to_jsonb(errs));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
