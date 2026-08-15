// 修仙问答 v25 · 失物招领 + 悬赏物品/跑腿 + 校花校草评选
import { supabase, getCurrentUserId } from './supabase';

// ===== 失物招领 =====
export async function listLostItems(kind = 'all', limit = 30, offset = 0, schoolId: number | null = null) {
  const { data, error } = await supabase.rpc('list_lost_items', { p_kind: kind, p_limit: limit, p_offset: offset, p_school_id: schoolId });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLostItem(params: {
  kind: 'lost' | 'found'; category: string; title: string;
  description?: string; image?: string; location?: string; contact?: string;
  schoolId?: number | null; reward?: number;
}) {
  const { data, error } = await supabase.rpc('create_lost_item', {
    p_kind: params.kind, p_category: params.category, p_title: params.title,
    p_description: params.description || '', p_image: params.image || '',
    p_location: params.location || '', p_contact: params.contact || '',
    p_school_id: params.schoolId ?? null, p_reward: params.reward || 0,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleLostLike(id: number) {
  const { data, error } = await supabase.rpc('toggle_lost_like', { p_item_id: id });
  if (error) throw new Error(error.message);
  return { liked: data };
}

export async function pinLostItem(id: number, days = 1) {
  const { data, error } = await supabase.rpc('pin_lost_item', { p_item_id: id, p_days: days });
  if (error) throw new Error(error.message);
  return data;
}

export async function resolveLostItem(id: number) {
  const { data, error } = await supabase.rpc('resolve_lost_item', { p_item_id: id });
  if (error) throw new Error(error.message);
  return data;
}

// ===== 悬赏物品/跑腿 =====

// 平台服务费率：从悬赏金额中抽成的比例（20%，互联网通用平台抽成中位，服务/交易类多在 10%-30%）。真扣成需在远端 Supabase 的 create_item_bounty 内实现，
// 前端此处仅作透明展示（发布页与悬赏榜都会标出服务费与赏金池）。调整比例只改这一处即可。
export const PLATFORM_FEE_RATE = 0.20;

export async function createItemBounty(params: {
  title: string; content: string; amount: number;
  type: 'item' | 'question' | 'service' | 'todo'; campusId?: number | null; contact?: string;
}) {
  const { data, error } = await supabase.rpc('create_item_bounty', {
    p_title: params.title, p_content: params.content, p_amount: params.amount,
    p_type: params.type, p_campus_id: params.campusId ?? null, p_contact: params.contact || '',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listBountiesV2(type = 'all', limit = 30) {
  const { data, error } = await supabase.rpc('list_bounties_v2', { p_type: type, p_limit: limit });
  if (error) throw new Error(error.message);
  return data || [];
}

// ===== 校园活动（v30） =====
export async function listCampusActivities(schoolId: number, limit = 10) {
  const { data, error } = await supabase.rpc('list_campus_activities', { p_school_id: schoolId, p_limit: limit });
  if (error) throw new Error(error.message);
  return data || [];
}

// ===== 校花校草评选 =====
export async function listBeautyActivities() {
  const { data } = await supabase.from('beauty_activities').select('*').order('created_at', { ascending: false }).limit(20);
  return data || [];
}

export async function getBeautyRanking(activityId: number) {
  const { data, error } = await supabase.rpc('get_beauty_ranking', { p_activity_id: activityId });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBeautyRankingByPeriod(activityId: number, period: 'month' | 'quarter' | 'year' | 'all') {
  const { data, error } = await supabase.rpc('get_beauty_ranking_by_period', { p_activity_id: activityId, p_period: period });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function applyBeautyCandidate(activityId: number, photo: string, slogan = '') {
  const { data, error } = await supabase.rpc('apply_beauty_candidate', {
    p_activity_id: activityId, p_photo: photo, p_slogan: slogan,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function voteBeauty(activityId: number, candidateId: number, paidCoin = 0) {
  const { data, error } = await supabase.rpc('vote_beauty', {
    p_activity_id: activityId, p_candidate_id: candidateId, p_paid_coin: paidCoin,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminCreateActivity(params: { title: string; gender: string; campusId?: number | null; days?: number }) {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('beauty_activities').insert({
    title: params.title, gender: params.gender, campus_id: params.campusId ?? null,
    end_at: new Date(Date.now() + (params.days || 14) * 864e5).toISOString(),
    status: 'active', created_by: uid,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminListCandidates(status = 'pending') {
  const { data } = await supabase.from('beauty_candidates').select('*, beauty_activities(title), profiles!user_id(nickname, avatar)').eq('status', status).order('created_at', { ascending: false }).limit(100);
  return data || [];
}

export async function adminReviewCandidate(id: number, approve: boolean) {
  const { error } = await supabase.from('beauty_candidates').update({ status: approve ? 'approved' : 'rejected' }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ===== 表白墙（v26/v28） =====
export async function listConfessions(limit = 30, offset = 0, schoolId: number | null = null) {
  const { data, error } = await supabase.rpc('list_confessions', { p_limit: limit, p_offset: offset, p_school_id: schoolId });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createConfession(params: { content: string; toName?: string; isAnonymous?: boolean; image?: string; schoolId?: number | null }) {
  const { data, error } = await supabase.rpc('create_confession', {
    p_content: params.content, p_to_name: params.toName || '',
    p_is_anonymous: params.isAnonymous !== false, p_image: params.image || '',
    p_school_id: params.schoolId ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function pinConfession(id: number, days = 1) {
  const { data, error } = await supabase.rpc('pin_confession', { p_id: id, p_days: days });
  if (error) throw new Error(error.message);
  return data;
}

export async function featureConfession(id: number, days = 1) {
  const { data, error } = await supabase.rpc('feature_confession', { p_id: id, p_days: days });
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleConfessionLike(id: number) {
  const { data, error } = await supabase.rpc('toggle_confession_like', { p_confession_id: id });
  if (error) throw new Error(error.message);
  return { liked: data };
}

// ===== 表白墙增强（v31）：发布收费 / 置顶收费 / 个人管理 / 故事后续 / 双方确认 =====
// 说明：pay_create_confession / pin_confession_paid 等新版 RPC 需先执行 sql/confession_features_v31.sql。
// 未执行时这里的封装会自动回退到旧逻辑（免费发布、¥2 置顶），保证线上不报错。

// 发布表白（优先付费版，未部署则回退免费版）
export async function payCreateConfession(params: {
  content: string; toName?: string; isAnonymous?: boolean; image?: string; schoolId?: number | null; amount?: number;
}) {
  try {
    const { data, error } = await supabase.rpc('pay_create_confession', {
      p_content: params.content,
      p_to_name: params.toName || '',
      p_is_anonymous: params.isAnonymous !== false,
      p_image: params.image || '',
      p_school_id: params.schoolId ?? null,
      p_amount: params.amount ?? 1,
    });
    if (error) throw error;
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  } catch (e: any) {
    if (/function .* does not exist|could not find function/i.test(e?.message || '')) {
      // 回退：未部署付费版时免费发布
      return createConfession(params);
    }
    throw e;
  }
}

// 置顶（优先付费版 ¥5/天，未部署则回退旧版 ¥2/天）
export async function pinConfessionPaid(id: number, days = 1, amount = 5) {
  try {
    const { data, error } = await supabase.rpc('pin_confession_paid', { p_id: id, p_days: days, p_amount: amount });
    if (error) throw error;
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  } catch (e: any) {
    if (/function .* does not exist|could not find function/i.test(e?.message || '')) {
      return pinConfession(id, days);
    }
    throw e;
  }
}

export async function deleteMyConfession(id: number) {
  const { data, error } = await supabase.rpc('delete_my_confession', { p_id: id });
  if (error) throw new Error(error.message);
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

export async function updateConfessionStory(id: number, text: string) {
  const { data, error } = await supabase.rpc('update_confession_story', { p_id: id, p_text: text });
  if (error) throw new Error(error.message);
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

// 表白人确认关系（并上传本方截图）
export async function confirmConfession(id: number, screenshot = '') {
  const { data, error } = await supabase.rpc('confirm_confession', { p_id: id, p_screenshot: screenshot });
  if (error) throw new Error(error.message);
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

// 被表白人接受表白（并上传本方截图）
export async function acceptConfession(id: number, screenshot = '') {
  const { data, error } = await supabase.rpc('accept_confession', { p_id: id, p_screenshot: screenshot });
  if (error) throw new Error(error.message);
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

// ===== 热搜（v28） =====
export async function buyHotSearch(questionId: number, hours = 24) {
  const { data, error } = await supabase.rpc('buy_hot_search', { p_question_id: questionId, p_hours: hours });
  if (error) throw new Error(error.message);
  return data;
}

export async function listHotSearch(limit = 10) {
  const { data, error } = await supabase.rpc('list_hot_search', { p_limit: limit });
  if (error) throw new Error(error.message);
  return data || [];
}

// ===== 评选（v28：全网/历史 + 点赞） =====
export async function toggleCandidateLike(candidateId: number) {
  const { data, error } = await supabase.rpc('toggle_candidate_like', { p_candidate_id: candidateId });
  if (error) throw new Error(error.message);
  return { liked: data };
}

export async function syncNationalCandidates(nationalActivityId: number) {
  const { data, error } = await supabase.rpc('sync_national_candidates', { p_national_activity_id: nationalActivityId });
  if (error) throw new Error(error.message);
  return data;
}

// 后台审核（表白/候选，v28 审核流）
export async function reviewPendingContent(reviewId: number, approve: boolean, reason = '') {
  const { data, error } = await supabase.rpc('review_confession', { p_review_id: reviewId, p_approve: approve, p_reason: reason });
  if (error) throw new Error(error.message);
  return data;
}
