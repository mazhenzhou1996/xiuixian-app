-- pre-fix: 清理历史版本残留对象（幂等），保证迁移可重跑
DROP POLICY IF EXISTS "pm_read_related" ON public.private_messages;
DROP POLICY IF EXISTS "pm_insert_own" ON public.private_messages;
DROP POLICY IF EXISTS "pm_update_read" ON public.private_messages;
DROP POLICY IF EXISTS "qf_read_own" ON public.question_follows;
DROP POLICY IF EXISTS "qf_insert_own" ON public.question_follows;
DROP POLICY IF EXISTS "qf_delete_own" ON public.question_follows;
DROP POLICY IF EXISTS "af_read_own" ON public.answer_follows;
DROP POLICY IF EXISTS "af_insert_own" ON public.answer_follows;
DROP POLICY IF EXISTS "af_delete_own" ON public.answer_follows;
DROP POLICY IF EXISTS "reports_read_own" ON public.reports;
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
DROP POLICY IF EXISTS "reports_delete_own" ON public.reports;
DROP POLICY IF EXISTS "question-images-insert" ON storage.objects;
DROP POLICY IF EXISTS "question-images-update" ON storage.objects;
DROP POLICY IF EXISTS "question-images-read" ON storage.objects;

DROP VIEW IF EXISTS public.profiles_public;

DROP FUNCTION IF EXISTS public.admin_delete_content(text, integer);
DROP FUNCTION IF EXISTS public.admin_penalize_user(uuid, text, integer, timestamptz, text);
DROP FUNCTION IF EXISTS public.admin_revoke_penalty(bigint);
DROP FUNCTION IF EXISTS public.get_my_penalty();
DROP FUNCTION IF EXISTS public.send_private_message(uuid, text);
DROP FUNCTION IF EXISTS public.expire_penalties();
DROP FUNCTION IF EXISTS public.admin_list_users(text);
DROP FUNCTION IF EXISTS public.admin_list_penalties(uuid);
DROP FUNCTION IF EXISTS public.admin_deduct_credit(uuid, integer, text);
DROP FUNCTION IF EXISTS public.get_my_credit();
DROP FUNCTION IF EXISTS public.admin_list_credit_logs(uuid);
