-- 修复:get_my_wallet / get_my_checkin 列名歧义(42702)
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS TABLE (balance INTEGER, income INTEGER, expense INTEGER, consult_count INTEGER, answered_count INTEGER) AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    COALESCE((SELECT p.balance FROM public.profiles p WHERE p.id = uid), 0),
    COALESCE((SELECT SUM(c.price) FROM public.consultations c WHERE c.expert_id = uid AND c.status <> 'refunded'), 0)::int,
    COALESCE((SELECT SUM(c2.price) FROM public.consultations c2 WHERE c2.customer_id = uid AND c2.status <> 'refunded'), 0)::int,
    (SELECT COUNT(*) FROM public.consultations c3 WHERE c3.customer_id = uid)::int,
    (SELECT COUNT(*) FROM public.consultations c4 WHERE c4.expert_id = uid AND c4.status = 'answered')::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_checkin()
RETURNS TABLE (checked_today BOOLEAN, streak INTEGER, balance INTEGER, total_reward INTEGER) AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    EXISTS (SELECT 1 FROM public.checkins ck WHERE ck.user_id = uid AND ck.checkin_date = CURRENT_DATE),
    COALESCE((SELECT ck2.streak FROM public.checkins ck2 WHERE ck2.user_id = uid ORDER BY ck2.checkin_date DESC LIMIT 1), 0),
    COALESCE((SELECT p.balance FROM public.profiles p WHERE p.id = uid), 0),
    COALESCE((SELECT SUM(ck3.reward) FROM public.checkins ck3 WHERE ck3.user_id = uid), 0)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
