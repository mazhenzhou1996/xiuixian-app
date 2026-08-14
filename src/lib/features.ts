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
export async function createItemBounty(params: {
  title: string; content: string; amount: number;
  type: 'item' | 'service' | 'todo'; campusId?: number | null; contact?: string;
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
