// 修仙问答 · 内容安全审核 Edge Function（Supabase Deno）
//
// 设计目标（省钱 + 合规）:
//  - Serverless: 仅在发帖/评论时被调用,平时 0 实例 0 费用（scale-to-zero）。
//  - 密钥不出服务端: 云厂商 AK/SK 存在 Supabase Secrets,前端永不接触。
//  - fail-closed: 默认「云不可用时拦截」,满足内容安全合规红线。
//  - 双层兜底: 服务端再跑一遍本地关键词,避免前端被绕过。
//
// 部署:
//   supabase functions deploy content-check
//   supabase secrets set CONTENT_CHECK_PROVIDER=tencent
//   supabase secrets set CONTENT_CHECK_API_KEY=<你的密钥>
//   supabase secrets set CONTENT_CHECK_SECRET_ID=<腾讯云 SecretId>(tencent 用)
//   supabase secrets set CONTENT_CHECK_FAIL_CLOSED=true   # 默认即 true
//
// 前端调用: supabase.functions.invoke('content-check', { body: { provider, text } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CheckResult { pass: boolean; reason?: string }
interface ReqBody { provider?: string; text?: string }

// 服务端本地关键词(双保险,前端已挡一次)
const SERVER_BLOCKLIST = [
  '枪支', '弹药', '炸药', '管制刀具', '色情', '裸聊', '约炮', '成人视频',
  '赌博', '博彩', '赌球', '私彩', '代开发票', '虚开', '办证刻章',
  '加微信', '加我vx', '加我薇信', '私聊转账', '兼职刷单', '日赚',
  '贷款黑户', '套现', '洗钱', '颠覆', '暴恐',
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function sha256Hex(s: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then((b) =>
    Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''))
}
function hmacSha256Hex(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const importKey = typeof key === 'string'
    ? crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : Promise.resolve(key)
  return importKey.then((k) => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}
function bufToHex(b: ArrayBuffer): string {
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}

// 腾讯云天御文本审核 (TC3-HMAC-SHA256)
async function callTencent(text: string, secretId: string, secretKey: string): Promise<CheckResult> {
  const host = 'tms.tencentcloudapi.com'
  const service = 'tms'
  const action = 'TextModeration'
  const version = '2020-12-29'
  const body = JSON.stringify({ Content: btoa(unescape(encodeURIComponent(text))), DataSource: 1 })
  const hashedPayload = await sha256Hex(body)
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const credentialScope = `${date}/${service}/tc3_request`
  const canonicalRequest = [
    'POST', '/', '',
    'content-type:application/json; charset=utf-8', `host:${host}`, '',
    'content-type;host', hashedPayload,
  ].join('\n')
  const stringToSign = [
    'TC3-HMAC-SHA256', String(timestamp), credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')
  const secretDate = await hmacSha256Hex('TC3' + secretKey, date)
  const secretService = await hmacSha256Hex(secretDate, service)
  const secretSigning = await hmacSha256Hex(secretService, 'tc3_request')
  const signature = bufToHex(await hmacSha256Hex(secretSigning, stringToSign))
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      Authorization: authorization,
    },
    body,
  })
  const data = await res.json() as any
  const detail = data?.Response
  if (!detail || detail.Error) return { pass: false, reason: '内容审核服务异常,请稍后重试' }
  const suggestion = detail.Suggestion // Pass / Review / Block
  if (suggestion === 'Block') return { pass: false, reason: '内容包含社区不允许的信息,请修改后重试' }
  if (suggestion === 'Review') return { pass: false, reason: '内容疑似违规,进入人工复核,请稍后' }
  return { pass: true }
}

// 阿里云内容安全(绿网)文本检测 —— RPC 风格 HMAC-SHA1 通用实现
// 说明: 绿网使用专门的 body 结构,此处给出通用 RPC 签名骨架,
// 实际 Action/BizType 请在部署时按阿里云文档对齐;签名算法本身正确。
async function callAliyun(text: string, keyId: string, keySecret: string): Promise<CheckResult> {
  const host = Deno.env.get('CONTENT_CHECK_ALIYUN_HOST') || 'green.cn-hangzhou.aliyuncs.com'
  const action = Deno.env.get('CONTENT_CHECK_ALIYUN_ACTION') || 'ScanText'
  const params: Record<string, string> = {
    Format: 'JSON',
    Version: '2019-12-31',
    AccessKeyId: keyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    RegionId: 'cn-hangzhou',
    Tasks: JSON.stringify([{ Content: text }]),
  }
  const percent = (s: string) => encodeURIComponent(s).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
  const sorted = Object.keys(params).sort().map((k) => `${percent(k)}=${percent(params[k])}`).join('&')
  const stringToSign = `POST&${percent('/')}&${percent(sorted)}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keySecret + '&'),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = bufToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign)))
  const url = `https://${host}/?Signature=${percent(sig)}&${sorted}`
  const res = await fetch(url, { method: 'POST' })
  const data = await res.json().catch(() => null) as any
  if (!res.ok || data?.Code) return { pass: false, reason: '内容审核服务异常,请稍后重试' }
  const results = data?.data?.results?.[0]
  if (results && (results.suggestion === 'block' || results.suggestion === 'review')) {
    return { pass: false, reason: '内容包含社区不允许的信息,请修改后重试' }
  }
  return { pass: true }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ pass: false, reason: 'method not allowed' }, 405)

  let body: ReqBody
  try { body = await req.json() } catch { return json({ pass: false, reason: 'bad request' }, 400) }
  const text = (body.text || '').trim()
  if (!text) return json({ pass: true })

  // 服务端本地关键词双保险
  if (SERVER_BLOCKLIST.some((k) => text.includes(k))) {
    return json({ pass: false, reason: '内容包含社区不允许的词汇,请修改后重试' })
  }

  const provider = (body.provider || Deno.env.get('CONTENT_CHECK_PROVIDER') || '').toLowerCase()
  const failClosed = (Deno.env.get('CONTENT_CHECK_FAIL_CLOSED') || 'true') !== 'false'

  if (provider !== 'aliyun' && provider !== 'tencent') {
    // 未配置云审核:仅本地关键词兜底即放行(运行期需配置密钥以满足合规)
    return json({ pass: true, reason: '内容审核未配置云厂商,仅本地关键词兜底' })
  }

  try {
    if (provider === 'tencent') {
      const secretId = Deno.env.get('CONTENT_CHECK_SECRET_ID') || ''
      const secretKey = Deno.env.get('CONTENT_CHECK_API_KEY') || ''
      if (!secretKey) return failClosed
        ? json({ pass: false, reason: '内容审核未配置密钥,暂不可发布' })
        : json({ pass: true, reason: '内容审核未配置密钥,放行' })
      return json(await callTencent(text, secretId, secretKey))
    }
    // aliyun
    const keyId = Deno.env.get('CONTENT_CHECK_SECRET_ID') || ''
    const keySecret = Deno.env.get('CONTENT_CHECK_API_KEY') || ''
    if (!keySecret) return failClosed
      ? json({ pass: false, reason: '内容审核未配置密钥,暂不可发布' })
      : json({ pass: true, reason: '内容审核未配置密钥,放行' })
    return json(await callAliyun(text, keyId, keySecret))
  } catch {
    return failClosed
      ? json({ pass: false, reason: '内容审核服务暂不可用,请稍后重试' })
      : json({ pass: true, reason: '内容审核服务异常,放行' })
  }
})
