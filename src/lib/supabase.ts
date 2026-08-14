import { createClient } from '@supabase/supabase-js';

// Supabase 配置
// 方式1: 从环境变量读取 (Vite 自动注入 VITE_ 前缀变量)
// 方式2: 回退到硬编码值 (当前已填入实际凭据)
// 两个 AI 助手 (WorkBuddy / AutoClaw) 修改 .env 文件即可切换环境

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nwxtyxjborhrbesssopg.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Xuxxhb_-GzxXFZm2LnW_8A_Co3_6E1x';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
}
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function phoneToEmail(phone: string): string {
  // 注意: xiuixian.app 无 MX 记录会被 GoTrue 邮箱校验拒绝，改用 xiuixian.cn（真实存在域）
  return `${phone}@xiuixian.cn`;
}

// 辅助：获取当前用户 UUID
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// 辅助：获取当前 profile
export async function getCurrentProfile() {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  return data;
}
