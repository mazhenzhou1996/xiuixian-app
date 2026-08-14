// 内容安全审核（上线合规闸门）
// 双层防护：
//   1) 本地关键词兜底（零成本、离线可用，必过）—— 命中直接拦截，不发往数据库
//   2) 云 API（可选）—— 配置 VITE_CONTENT_CHECK=aliyun|tencent 后启用，
//      建议放在 Supabase Edge Function / 后端代理里调用，避免前端暴露密钥
//
// 在所有写内容入口（提问/回答/评论）调用 checkText，命中即抛错拦截。

// 敏感词黑名单（涉政/涉黄/涉暴/涉赌/导流广告等）—— 生产应在管理后台可配置（已有 auto_review_rules 表）
const LOCAL_BLOCKLIST = [
  '枪支', '弹药', '炸药', '管制刀具',
  '色情', '裸聊', '约炮', '成人视频',
  '赌博', '博彩', '赌球', '私彩',
  '代开发票', '虚开', '办证刻章',
  '加微信', '加我vx', '加我薇信', '私聊转账', '兼职刷单', '日赚',
  '贷款黑户', '套现', '洗钱',
  '涉政煽动', '颠覆', '暴恐',
];

const SENSITIVE_HINT = '内容包含社区不允许的词汇，请修改后重试';

export interface CheckResult {
  pass: boolean;
  reason?: string;
}

/**
 * 校验一段文本是否通过内容安全。
 * 返回 { pass:false, reason } 表示应拦截。
 */
export async function checkText(text: string): Promise<CheckResult> {
  if (!text || text.trim().length === 0) return { pass: true };

  // 1) 本地关键词兜底
  const hit = LOCAL_BLOCKLIST.find((k) => text.includes(k));
  if (hit) return { pass: false, reason: SENSITIVE_HINT };

  // 2) 云 API（可选）
  const provider = (import.meta.env.VITE_CONTENT_CHECK as string) || '';
  if (provider === 'aliyun' || provider === 'tencent') {
    try {
      const cloud = await cloudCheck(provider, text);
      if (!cloud.pass) return cloud;
    } catch {
      // 云调用失败不阻断（兜底本地已通过）。
      // 生产建议：失败即拦截（fail-closed），此处为保证可用性放宽。
    }
  }
  return { pass: true };
}

/**
 * 云内容安全调用（真实调用，留 KEY 即用）。
 *
 * 接入步骤（合规要求：文本+图片双审核）：
 *   1) 在 Supabase 部署 Edge Function，例如路由 /api/content-check
 *   2) 函数内调用阿里云内容安全 TextScan / 腾讯云天御，返回 { pass:boolean, reason?:string }
 *   3) 前端通过 VITE_CONTENT_CHECK_ENDPOINT 指定地址（默认 /api/content-check）
 *   4) 可选 VITE_CONTENT_CHECK_FAIL_CLOSED=true：云端不可用时「失败即拦截」（更严格合规）
 *
 * 未部署 / 未配置时默认放行（本地关键词兜底仍生效）。
 */
async function cloudCheck(_provider: string, _text: string): Promise<CheckResult> {
  // 走 Supabase Edge Function（serverless），密钥存于 Supabase Secrets，前端永不接触。
  // 合规默认：云端不可达即拦截（fail-closed）；设置 VITE_CONTENT_CHECK_FAIL_CLOSED=false 可放宽（仅开发用）。
  const failClosed = (import.meta.env.VITE_CONTENT_CHECK_FAIL_CLOSED as string) !== 'false';
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.functions.invoke('content-check', {
      body: { provider: _provider, text: _text },
    });
    if (error) throw error;
    const d = data as Partial<CheckResult>;
    if (d && typeof d.pass === 'boolean') return { pass: d.pass, reason: d.reason };
    return { pass: true };
  } catch {
    if (failClosed) return { pass: false, reason: '内容安全服务暂不可用，请稍后重试' };
    return { pass: true };
  }
}
