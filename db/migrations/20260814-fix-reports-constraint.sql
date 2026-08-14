-- 修复:reports 表约束支持 consultation 类型
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('question','answer','comment','user','message','consultation'));
