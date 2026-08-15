-- ============================================================
-- 修仙问答 v32 · 邮箱化 + 演示账号清理 (2026-08-15)
-- 在 Supabase Dashboard → SQL Editor 整体执行（可重复执行）
-- 1) 将 mazhenzhou1996@163.com 设为管理员
-- 2) 删除除 mazhenzhou1996@163.com 外的所有账号（含演示账号及其内容）
-- ============================================================

-- ---------- 1. 将本人账号设为管理员 ----------
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'mazhenzhou1996@163.com');
-- 注意：若影响 0 行，说明该邮箱尚未注册，请先用该邮箱注册后再执行

-- ---------- 2. 删除其他所有账号（含演示账号 13800138001~05） ----------
DO $$
DECLARE
  target_ids uuid[];
  r record;
BEGIN
  SELECT array_agg(id) INTO target_ids FROM auth.users
  WHERE email IS DISTINCT FROM 'mazhenzhou1996@163.com';
  IF target_ids IS NULL THEN
    RAISE NOTICE '没有需要删除的账号';
    RETURN;
  END IF;

  -- 2.1 清理内容表（动态匹配所有 user 相关列）
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('user_id','author_id','sender_id','receiver_id','target_id','liker_id','inviter_id','invitee_id','reviewer_id','owner_id','created_by')
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)', r.table_name, r.column_name) USING target_ids;
  END LOOP;

  -- 2.2 删除 profiles
  DELETE FROM public.profiles WHERE id = ANY(target_ids);

  -- 2.3 删除 auth 用户
  DELETE FROM auth.users WHERE id = ANY(target_ids);

  RAISE NOTICE '已删除 % 个账号（保留 mazhenzhou1996@163.com）', array_length(target_ids, 1);
END $$;
