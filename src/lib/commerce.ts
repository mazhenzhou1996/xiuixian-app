// 修仙问答 v23 · 商业化 API（钱包/配置/展板/商家/广告位）
import { supabase, getCurrentUserId } from './supabase';

// ===== 全局配置（热读，本地缓存 60s） =====
let cfgCache: Record<string, any> | null = null;
let cfgAt = 0;

export async function getConfig(key: string): Promise<any> {
  if (cfgCache && Date.now() - cfgAt < 60_000) return cfgCache[key];
  const { data } = await supabase.from('config').select('key, value');
  cfgCache = {};
  (data || []).forEach((c: any) => { cfgCache![c.key] = c.value; });
  cfgAt = Date.now();
  return cfgCache[key];
}

export async function refreshConfig() { cfgCache = null; }

// ===== 钱包 =====
export async function getMyWallet() {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data } = await supabase.from('wallets').select('*').eq('owner_id', uid).maybeSingle();
  return data;
}

// 激励视频领灵石（服务端防刷：每日上限 30 次）
export async function claimRewardCoin() {
  const { data, error } = await supabase.rpc('reward_watch_ad');
  if (error) throw new Error(error.message);
  return data;
}

// ===== 私域广告展板 =====
export async function listAdBoards(campusId: number) {
  const { data, error } = await supabase.rpc('list_ad_boards', { p_campus_id: campusId });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function trackBoard(boardId: number, action: 'view' | 'click') {
  try { await supabase.rpc('board_track', { p_board_id: boardId, p_action: action }); } catch { /* ignore */ }
}

// 商家购买展板位（余额支付）
export async function buyBoardSlot(params: {
  campusId: number; slot: number; duration: 'weekly' | 'monthly' | 'quarterly';
  title: string; body?: string; link?: string;
}) {
  const { data, error } = await supabase.rpc('buy_board_slot', {
    p_campus_id: params.campusId, p_slot: params.slot, p_duration: params.duration,
    p_title: params.title, p_body: params.body || '', p_link: params.link || '',
  });
  if (error) throw new Error(error.message);
  return data;
}

// ===== 校园商家 =====
export async function applyMerchant(params: { shopName: string; category: string; description?: string; address?: string }) {
  const { data, error } = await supabase.rpc('apply_merchant', {
    p_shop_name: params.shopName, p_category: params.category,
    p_description: params.description || '', p_address: params.address || '',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyMerchant() {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data } = await supabase.from('merchants').select('*').eq('owner_id', uid).order('id', { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function listMerchantsByCampus(campusId: number) {
  const { data } = await supabase.from('merchants').select('*').eq('campus_id', campusId).eq('status', 'approved');
  return data || [];
}

// ===== 校区 =====
export async function listCampuses() {
  const { data } = await supabase.from('campuses').select('*').eq('enabled', true);
  return data || [];
}

// ===== 平台广告管理（后台） =====
export async function listAllBoards(status = 'active') {
  const { data } = await supabase.from('ad_boards').select('*, merchants(shop_name)').eq('status', status).order('created_at', { ascending: false }).limit(200);
  return data || [];
}

export async function saveBoard(b: any, isNew: boolean) {
  if (isNew) {
    const { error } = await supabase.from('ad_boards').insert({
      campus_id: b.campus_id, slot: b.slot || 0, advertiser_type: b.advertiser_type || 'platform',
      title: b.title, body: b.body || '', image: b.image || '', link: b.link || '',
      starts_at: b.starts_at, ends_at: b.ends_at, status: b.status || 'active',
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('ad_boards').update({
      slot: b.slot, title: b.title, body: b.body || '', image: b.image || '',
      link: b.link || '', starts_at: b.starts_at, ends_at: b.ends_at, status: b.status,
    }).eq('id', b.id);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function setBoardStatus(id: number, status: 'active' | 'paused' | 'ended') {
  const { error } = await supabase.from('ad_boards').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listAdPushes() {
  const { data } = await supabase.from('ad_pushes').select('*').order('created_at', { ascending: false }).limit(100);
  return data || [];
}

export async function createAdPush(p: { title: string; body?: string; targetCampusId?: number | null; targetCategory?: string; channel?: string }) {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('ad_pushes').insert({
    title: p.title, body: p.body || '', target_campus_id: p.targetCampusId ?? null,
    target_category: p.targetCategory || '', channel: p.channel || 'inapp', status: 'sent', created_by: uid,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// 后台商家审核
export async function adminListMerchants(status = 'pending') {
  const { data } = await supabase.from('merchants').select('*, profiles!owner_id(nickname, avatar)').eq('status', status).order('created_at', { ascending: false }).limit(100);
  return data || [];
}

export async function adminReviewMerchant(id: number, approve: boolean, reason = '') {
  const { data, error } = await supabase.rpc('review_merchant', { p_merchant_id: id, p_approve: approve, p_reason: reason });
  if (error) throw new Error(error.message);
  return data;
}
