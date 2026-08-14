-- 更新 admin_list_users 加 balance 列
DROP FUNCTION IF EXISTS public.admin_list_users(TEXT);
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users(kw TEXT DEFAULT '')
RETURNS TABLE (
  id UUID, phone TEXT, nickname TEXT, avatar TEXT, realm TEXT, points INTEGER,
  is_admin BOOLEAN, created_at TIMESTAMPTZ, credit INTEGER, balance INTEGER,
  penalty_type TEXT, penalty_until TIMESTAMPTZ, penalty_reason TEXT, penalty_id BIGINT
) AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '无管理员权限'; END IF;
  RETURN QUERY
  SELECT p.id, p.phone, p.nickname, p.avatar, p.realm, p.points, p.is_admin, p.created_at,
         COALESCE(p.credit, 100), COALESCE(p.balance, 0),
         up.type, up.until, up.reason, up.id
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT * FROM public.user_penalties up2
    WHERE up2.user_id = p.id AND up2.status = 'active'
      AND (up2.until IS NULL OR up2.until > NOW())
    ORDER BY up2.id DESC LIMIT 1
  ) up ON true
  WHERE kw = '' OR p.nickname ILIKE '%' || kw || '%' OR p.phone ILIKE '%' || kw || '%'
  ORDER BY p.created_at DESC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
