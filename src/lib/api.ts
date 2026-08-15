// Supabase-based API client
// 所有接口保持与原 Express 版本相同的返回格式

import { supabase, phoneToEmail, getCurrentUserId, getCurrentProfile } from './supabase';
import { checkText } from './contentcheck';

// 图片前端压缩：canvas 缩放 + WebP 编码，显著降低 Storage 体积与 CDN 带宽
// （Supabase 免费档存储/出口带宽有限，压缩可放大可用容量一个数量级）
// 环境不支持时（SSR/无 canvas）安全回退原文件。
async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('decode fail'));
      im.src = url;
    });
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return file; }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (!blob) return file;
    const base = (file.name.split('.').shift() || 'image').replace(/[^\w-]/g, '');
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  }
}

// 辅助：映射数据库行到前端格式
function mapQuestion(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    content: r.content,
    type: r.type,
    viewCount: r.view_count,
    hotScore: r.hot_score,
    likeCount: r.like_count,
    images: r.images || [],
    createdAt: r.created_at,
    authorName: r.profiles?.nickname || r.author_name,
    authorAvatar: r.profiles?.avatar || r.author_avatar || '',
    authorRealm: r.profiles?.realm || r.author_realm,
    answerCount: r.answer_count ?? 0,
    isAnonymous: !!r.is_anonymous,
    schoolId: r.school_id ?? null,
    status: r.status || 'active',
  };
}

function mapAnswer(r: any) {
  return {
    id: r.id,
    questionId: r.question_id,
    userId: r.user_id,
    content: r.content,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    createdAt: r.created_at,
    authorName: r.profiles?.nickname || r.author_name,
    authorAvatar: r.profiles?.avatar || r.author_avatar || '',
    authorRealm: r.profiles?.realm || r.author_realm,
    isAnonymous: !!r.is_anonymous,
    status: r.status || 'active',
    tipCount: r.tip_count || 0,
    tipAmount: r.tip_amount || 0,
  };
}

function mapComment(r: any) {
  return {
    id: r.id,
    answerId: r.answer_id,
    userId: r.user_id,
    content: r.content,
    replyTo: r.reply_to,
    replyToUserId: r.reply_to_user_id,
    likeCount: r.like_count,
    createdAt: r.created_at,
    authorName: r.profiles?.nickname || r.author_name,
    authorAvatar: r.profiles?.avatar || r.author_avatar || '',
    authorRealm: r.profiles?.realm || r.author_realm,
  };
}

function mapUser(r: any) {
  return {
    id: r.id,
    phone: r.phone || '',
    nickname: r.nickname,
    avatar: r.avatar,
    realm: r.realm,
    stage: r.stage || 'early',
    points: r.points,
    bio: r.bio,
    school: r.school || '',
    isAdmin: !!r.is_admin,
    hideContent: !!r.hide_content,
    enablePersonalized: r.enable_personalized !== false,
    createdAt: r.created_at,
  };
}

export const api = {
  // ---- Auth ----
  async login(account: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      // 支持手机号或邮箱登录：含 @ 视为邮箱，否则按手机号转邮箱
      email: account.includes('@') ? account.trim() : phoneToEmail(account.trim()),
      password,
    });
    if (error) throw new Error('账号不存在或密码错误');
    // 获取 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user!.id)
      .single();
    if (!profile) throw new Error('用户资料不存在');
    return { user: mapUser(profile), token: data.session?.access_token || '' };
  },

  async register(email: string, nickname: string, password: string, school?: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { email: email.trim(), nickname, realm: 'lianqi', school: school || '' },
      },
    });
    if (error) throw new Error(error.message || '注册失败');
    // 触发器会自动创建 profile
    // 等待一下让触发器完成
    await new Promise(r => setTimeout(r, 500));
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user!.id)
      .single();
    if (!profile) throw new Error('创建用户资料失败');
    // 未自动登录时（公开注册，邮箱确认由 DB 触发器自动放行），立即用同凭据登录
    if (!data.session) {
      const { error: signinErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signinErr) throw new Error('注册成功但自动登录失败，请前往登录页');
    }
    return { user: mapUser(profile), token: data.session?.access_token || '' };
  },

  // ---- 邀请码（防刷/灰度注册闸门） ----
  async validateInviteCode(code: string) {
    const { data, error } = await supabase.rpc('validate_invite_code', {
      p_code: (code || '').trim().toUpperCase(),
    });
    if (error) throw new Error(error.message || '邀请码校验失败');
    return !!data;
  },

  async generateInviteCodes(count: number, note = '', maxUses = 1) {
    const { data, error } = await supabase.rpc('generate_invite_codes', {
      p_count: count,
      p_note: note,
      p_max_uses: maxUses,
    });
    if (error) throw new Error(error.message || '生成失败');
    return (data as string[]) || [];
  },

  async getMe() {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('未登录');
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('用户不存在');
    const [qc, ac, fc, fgc] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('answers').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
    ]);
    return {
      user: mapUser(profile),
      stats: {
        questionCount: qc.count || 0,
        answerCount: ac.count || 0,
        followerCount: fc.count || 0,
        followingCount: fgc.count || 0,
      },
    };
  },

  // ---- Questions ----
  async getQuestions(sort?: string, opts?: { schoolId?: number | null; offset?: number; limit?: number }) {
    const col = sort === 'new' ? 'created_at' : 'hot_score';
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const schoolId = opts?.schoolId ?? null;
    // 优先：一次查询带出回答数聚合（PostgREST embedded resource count），避免 N+1
    try {
      let query = supabase
        .from('questions')
        .select('*, profiles!user_id(nickname, avatar, realm), answers!answers_question_id_fkey(count)')
        .order(col, { ascending: false })
        .range(offset, offset + limit - 1);
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data } = await query;
      if (data) {
        return data.map((q: any) => {
          const agg = Array.isArray(q.answers) && q.answers.length > 0 ? q.answers[0] : null;
          return {
            ...mapQuestion(q),
            answerCount: agg?.count ?? 0,
          };
        });
      }
    } catch {
      // 聚合查询失败时回退到旧逻辑
    }
    let query2 = supabase
      .from('questions')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .order(col, { ascending: false })
      .range(offset, offset + limit - 1);
    if (schoolId) query2 = query2.eq('school_id', schoolId);
    const { data } = await query2;
    if (!data) return [];
    // 获取每个问题的回答数
    const questionIds = data.map(q => q.id);
    const { data: answers } = await supabase
      .from('answers')
      .select('question_id')
      .in('question_id', questionIds);
    const countMap: Record<number, number> = {};
    (answers || []).forEach(a => {
      countMap[a.question_id] = (countMap[a.question_id] || 0) + 1;
    });
    return data.map(q => ({
      ...mapQuestion(q),
      answerCount: countMap[q.id] || 0,
    }));
  },

  // 游标分页：用于首页/热榜无限滚动（标准 keyset 分页，避免 offset 深翻页性能劣化）
  async getQuestionsCursor(opts?: { sort?: string; schoolId?: number | null; limit?: number; cursor?: string }) {
    const sort = opts?.sort || 'hot';
    const col = sort === 'new' ? 'created_at' : 'hot_score';
    const limit = opts?.limit ?? 20;
    const schoolId = opts?.schoolId ?? null;
    let query = supabase
      .from('questions')
      .select('*, profiles!user_id(nickname, avatar, realm), answers!answers_question_id_fkey(count)')
      .order(col, { ascending: false })
      .limit(limit);
    if (schoolId) query = query.eq('school_id', schoolId);
    if (opts?.cursor) {
      try {
        const { v, id } = JSON.parse(opts.cursor) as { v: number | string; id: number };
        query = query.or(`${col}.lt.${v},and(${col}.eq.${v},id.lt.${id})`);
      } catch { /* 游标非法则忽略 */ }
    }
    const { data } = await query;
    if (!data || data.length === 0) return { items: [], nextCursor: null as string | null };
    const items = data.map((q: any) => {
      const agg = Array.isArray(q.answers) && q.answers.length > 0 ? q.answers[0] : null;
      return { ...mapQuestion(q), answerCount: agg?.count ?? 0 };
    });
    const hasMore = data.length === limit;
    const last = data[data.length - 1];
    const nextCursor = hasMore ? JSON.stringify({ v: last[col], id: last.id }) : null;
    return { items, nextCursor };
  },

  async getQuestion(id: string) {
    // 增加浏览量
    await supabase.rpc('increment_view_count', { qid: Number(id) });
    const { data } = await supabase
      .from('questions')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .eq('id', Number(id))
      .single();
    if (!data) throw new Error('问题不存在');
    const { count } = await supabase
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', Number(id));
    return { ...mapQuestion(data), answerCount: count || 0 };
  },

  async createQuestion(data: { title: string; content: string; type?: string; images?: string[]; schoolId?: number | null; isAnonymous?: boolean }) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    if (!data.title || data.title.length < 5) throw new Error('标题至少5个字');
    const chk = await checkText(`${data.title}\n${data.content || ''}`);
    if (!chk.pass) throw new Error(chk.reason || '内容未通过审核');
    const { data: res, error } = await supabase.rpc('create_question', {
      p_title: data.title,
      p_content: data.content || '',
      p_type: data.type || 'normal',
      p_images: data.images || [],
      p_school_id: data.schoolId ?? null,
      p_is_anonymous: !!data.isAnonymous,
    });
    if (error) throw new Error(error.message);
    const { data: q } = await supabase.from('questions').select('*, profiles!user_id(nickname, avatar, realm)').eq('id', res.id).single();
    return { ...mapQuestion(q), pending: !!res?.pending, flagged: !!res?.flagged };
  },

  // 上传图片到 Supabase Storage，返回公网 URL（提问/回答正文用）
  async uploadImage(file: File): Promise<string> {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    // 先压缩（WebP），失败回退原图
    const toUpload = await compressImage(file);
    if (toUpload.size > 5 * 1024 * 1024) throw new Error('图片压缩后仍超过 5MB，请换一张');
    const ext = (toUpload.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('question-images').upload(path, toUpload, {
      cacheControl: '3600',
      upsert: false,
      contentType: toUpload.type,
    });
    if (error) throw new Error('图片上传失败：' + error.message);
    const { data: pub } = supabase.storage.from('question-images').getPublicUrl(path);
    return pub.publicUrl;
  },

  // ---- 视频上传（私信使用；pm-media bucket，上限 100MB） ----
  async uploadVideo(file: File): Promise<string> {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    if (file.size > 100 * 1024 * 1024) throw new Error('视频不能超过 100MB');
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('pm-media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'video/mp4',
    });
    if (error) throw new Error('视频上传失败：' + (error.message || ''));
    const { data: pub } = supabase.storage.from('pm-media').getPublicUrl(path);
    return pub.publicUrl;
  },

  async search(q: string) {
    const { data } = await supabase
      .from('questions')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order('hot_score', { ascending: false })
      .limit(20);
    return (data || []).map(mapQuestion);
  },

  // 搜索用户(昵称模糊;公开视图不含手机号)
  async searchUsers(q: string) {
    const { data, error } = await supabase
      .from('profiles_public')
      .select('*')
      .ilike('nickname', `%${q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (data || []).map(mapUser);
  },

  // 搜索大学(名称/省份/城市模糊)
  async searchUniversities(q: string) {
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .or(`(name.ilike.%${q}%,province.ilike.%${q}%,city.ilike.%${q}%)`)
      .order('sort_order', { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- Answers ----
  async getAnswers(questionId: string) {
    const { data } = await supabase
      .from('answers')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .eq('question_id', Number(questionId))
      .order('like_count', { ascending: false });
    return (data || []).map(mapAnswer);
  },

  async createAnswer(questionId: string, content: string, opts?: { isAnonymous?: boolean }) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    if (!content || content.length < 10) throw new Error('回答至少10个字');
    const chk = await checkText(content);
    if (!chk.pass) throw new Error(chk.reason || '内容未通过审核');
    const { data: profile } = await supabase.from('profiles').select('nickname, avatar, realm').eq('id', uid).single();
    const { data: res, error } = await supabase.rpc('create_answer', {
      p_question_id: Number(questionId),
      p_content: content,
      p_is_anonymous: !!opts?.isAnonymous,
    });
    if (error) throw new Error(error.message);
    const { data: a } = await supabase.from('answers').select('*').eq('id', res.id).single();
    return { ...mapAnswer(a), authorName: profile?.nickname, authorAvatar: profile?.avatar, authorRealm: profile?.realm, pending: !!res?.pending };
  },

  // ---- Comments ----
  async getComments(answerId: string) {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .eq('answer_id', Number(answerId))
      .order('created_at', { ascending: true });
    return (data || []).map(mapComment);
  },

  async createComment(answerId: string, data: { content: string; replyTo?: string | number; replyToUserId?: string | number }) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    if (!data.content) throw new Error('请输入评论内容');
    const chk = await checkText(data.content);
    if (!chk.pass) throw new Error(chk.reason || '内容未通过审核');
    const { data: profile } = await supabase.from('profiles').select('nickname, avatar, realm').eq('id', uid).single();
    const { data: c } = await supabase.rpc('add_comment', {
      a_id: Number(answerId),
      c_text: data.content,
      r_to: data.replyTo ? String(data.replyTo) : null,
      r_to_uid: data.replyToUserId || null,
    });
    return { ...mapComment(c), authorName: profile?.nickname, authorAvatar: profile?.avatar, authorRealm: profile?.realm };
  },

  // ---- Likes ----
  async toggleLike(targetType: string, targetId: number) {
    const { data } = await supabase.rpc('toggle_like', { t_type: targetType, t_id: targetId });
    return { liked: data };
  },

  async getMyLikes() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase.from('likes').select('target_type, target_id').eq('user_id', uid);
    return (data || []).map((l: any) => ({ targetType: l.target_type, targetId: l.target_id }));
  },

  // ---- Favorites ----
  async toggleFavorite(questionId: number) {
    const { data } = await supabase.rpc('toggle_favorite', { q_id: questionId });
    return { favorited: data };
  },

  async getMyFavorites() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('favorites')
      .select('questions(*, profiles!user_id(nickname))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    return (data || []).map((f: any) => f.questions ? {
      ...mapQuestion(f.questions),
      authorName: (f.questions.profiles as any)?.nickname,
    } : null).filter(Boolean);
  },

  // ---- Follows ----
  async toggleFollow(followingId: string | number) {
    const { data } = await supabase.rpc('toggle_follow', { f_id: String(followingId) });
    return { following: data };
  },

  async checkFollow(userId: string | number) {
    const uid = await getCurrentUserId();
    if (!uid) return { following: false };
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', uid)
      .eq('following_id', String(userId))
      .maybeSingle();
    return { following: !!data };
  },

  async getMyFollowing() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
    return (data || []).map((f: any) => String(f.following_id));
  },

  // ---- Question follows（数据库版，替换 localStorage） ----
  async getFollowedQuestions() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('question_follows')
      .select('id, question_id, last_answer_count, created_at, questions!question_id(title, answer_count)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    return (data || []).map((f: any) => ({
      id: String(f.question_id),
      title: f.questions?.title || '',
      time: new Date(f.created_at).getTime(),
      lastAnswerCount: f.last_answer_count ?? 0,
      answerCount: f.questions?.answer_count ?? 0,
    }));
  },

  async isQuestionFollowed(questionId: number | string) {
    const uid = await getCurrentUserId();
    if (!uid) return false;
    const { data } = await supabase
      .from('question_follows')
      .select('id')
      .eq('user_id', uid)
      .eq('question_id', Number(questionId))
      .maybeSingle();
    return !!data;
  },

  async getQuestionFollowerCount(questionId: number | string) {
    const { count } = await supabase
      .from('question_follows')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', Number(questionId));
    return count || 0;
  },

  async toggleQuestionFollow(questionId: number | string, answerCount: number) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const qid = Number(questionId);
    const { data: existing } = await supabase
      .from('question_follows')
      .select('id')
      .eq('user_id', uid)
      .eq('question_id', qid)
      .maybeSingle();
    if (existing) {
      await supabase.from('question_follows').delete().eq('user_id', uid).eq('question_id', qid);
      return false;
    }
    await supabase.from('question_follows').insert({
      user_id: uid,
      question_id: qid,
      last_answer_count: answerCount || 0,
    });
    return true;
  },

  async markQuestionChecked(questionId: number | string, answerCount: number) {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('question_follows')
      .update({ last_answer_count: answerCount || 0 })
      .eq('user_id', uid)
      .eq('question_id', Number(questionId));
  },

  // ---- Answer follows（数据库版，替换 localStorage） ----
  async getFollowedAnswers() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('answer_follows')
      .select('id, answer_id, question_id, last_like_count, created_at, answers!answer_id(content, like_count), questions!question_id(title)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    return (data || []).map((f: any) => ({
      id: String(f.answer_id),
      questionId: String(f.question_id),
      content: f.answers?.content || '',
      time: new Date(f.created_at).getTime(),
      lastLikeCount: f.last_like_count ?? 0,
      likeCount: f.answers?.like_count ?? 0,
      questionTitle: f.questions?.title || '',
    }));
  },

  async isAnswerFollowed(answerId: number | string) {
    const uid = await getCurrentUserId();
    if (!uid) return false;
    const { data } = await supabase
      .from('answer_follows')
      .select('id')
      .eq('user_id', uid)
      .eq('answer_id', Number(answerId))
      .maybeSingle();
    return !!data;
  },

  async toggleAnswerFollow(answer: any) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const aid = Number(answer.id);
    const { data: existing } = await supabase
      .from('answer_follows')
      .select('id')
      .eq('user_id', uid)
      .eq('answer_id', aid)
      .maybeSingle();
    if (existing) {
      await supabase.from('answer_follows').delete().eq('user_id', uid).eq('answer_id', aid);
      return false;
    }
    await supabase.from('answer_follows').insert({
      user_id: uid,
      answer_id: aid,
      question_id: Number(answer.questionId),
      last_like_count: answer.likeCount || 0,
    });
    return true;
  },

  async markAnswerChecked(answerId: number | string, likeCount: number) {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('answer_follows')
      .update({ last_like_count: likeCount || 0 })
      .eq('user_id', uid)
      .eq('answer_id', Number(answerId));
  },

  // ---- Private messages（数据库版，替换 localStorage 假聊天） ----
  async getPmConversations() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('private_messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!data || data.length === 0) return [];
    const map = new Map<string, any>();
    for (const m of data) {
      const other = String(m.sender_id) === String(uid) ? String(m.receiver_id) : String(m.sender_id);
      if (!map.has(other)) {
        map.set(other, {
          userId: other,
          lastTime: new Date(m.created_at).getTime(),
          lastMsg: m.content,
          unread: 0,
        });
      }
      if (String(m.receiver_id) === String(uid) && !m.read_at) {
        map.get(other).unread += 1;
      }
    }
    const convs = Array.from(map.values());
    const { data: profiles } = await supabase
      .from('profiles_public')
      .select('id, nickname, avatar, realm')
      .in('id', convs.map((c: any) => c.userId));
    const pMap = new Map((profiles || []).map((p: any) => [String(p.id), p]));
    return convs.map((c: any) => ({ ...c, peer: pMap.get(c.userId) || null }));
  },

  async getPmMessages(userId: string) {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('private_messages')
      .select('id, sender_id, content, msg_type, created_at')
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${uid})`)
      .order('created_at', { ascending: true })
      .limit(500);
    return (data || []).map((m: any) => ({
      id: String(m.id),
      from: String(m.sender_id) === String(uid) ? 'me' : 'other',
      content: m.content,
      type: m.msg_type || 'text',
      time: new Date(m.created_at).getTime(),
    }));
  },

  async sendPmMessage(userId: string, content: string, type: 'text' | 'image' | 'video' = 'text') {
    const { data, error } = await supabase.rpc('send_private_message', {
      to_uid: userId,
      msg: content,
      p_type: type,
    });
    if (error || !data) throw new Error(error?.message || '发送失败');
    return {
      id: String(data.id),
      from: 'me' as const,
      content: data.content,
      type: data.msg_type || 'text',
      time: new Date(data.created_at).getTime(),
    };
  },

  async markPmRead(userId: string) {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase
      .from('private_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', uid)
      .eq('sender_id', userId)
      .is('read_at', null);
  },

  // ---- Reports（举报落库） ----
  async submitReport(params: { targetType: string; targetId: string; targetUserId?: string; reason?: string; content?: string }) {
    const { data, error } = await supabase.rpc('submit_report', {
      t_type: params.targetType,
      t_id: params.targetId,
      t_user_id: params.targetUserId || null,
      reason: params.reason || '',
      extra: params.content || '',
    });
    if (error || !data) throw new Error(error?.message || '举报提交失败');
    return { id: String(data.id) };
  },

  // ---- User stats & answers ----
  async getUserStats(userId: string | number) {
    const [fc, fgc, qc, ac] = await Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', String(userId)),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', String(userId)),
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('user_id', String(userId)),
      supabase.from('answers').select('id', { count: 'exact', head: true }).eq('user_id', String(userId)),
    ]);
    return {
      followerCount: fc.count || 0,
      followingCount: fgc.count || 0,
      questionCount: qc.count || 0,
      answerCount: ac.count || 0,
    };
  },

  async getUserAnswers(userId: string | number) {
    const { data } = await supabase
      .from('answers')
      .select('*, profiles!user_id(nickname, avatar, realm), questions(title)')
      .eq('user_id', String(userId))
      .order('created_at', { ascending: false });
    return (data || []).map(a => ({
      ...mapAnswer(a),
      questionTitle: a.questions?.title,
    }));
  },

  // ---- Penalty（禁言/封禁校验） ----
  async getMyPenalty() {
    const { data } = await supabase.rpc('get_my_penalty');
    return data || null;
  },

  // ---- Appeal（申诉） ----
  async submitAppeal(penaltyId: number | string, reason: string) {
    const { data, error } = await supabase.rpc('submit_appeal', {
      p_penalty_id: Number(penaltyId),
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getMyAppeals() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('appeals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  },

  // ---- Promotion（声望晋级） ----
  async applyPromotion() {
    const { data, error } = await supabase.rpc('apply_promotion');
    if (error) throw new Error(error.message);
    return data;
  },

  async getMyPromotion() {
    const { data, error } = await supabase.rpc('get_my_promotion');
    if (error) return null;
    return data && data.length > 0 ? data[0] : null;
  },

  // ---- Credit（信誉系统） ----
  async getMyCredit() {
    const { data, error } = await supabase.rpc('get_my_credit');
    if (error) return null;
    return data && data.length > 0 ? data[0] : null;
  },

  // ---- Consultation（付费咨询） ----
  async getConsultationSetting(userId: string) {
    const { data } = await supabase
      .from('consultation_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  },

  async saveConsultationSetting(price: number, enabled: boolean) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const { data, error } = await supabase
      .from('consultation_settings')
      .upsert({ user_id: uid, price: Math.max(0, Math.min(9999, Math.round(price))), enabled, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async createConsultation(expertId: string, question: string) {
    const { data, error } = await supabase.rpc('create_consultation', {
      p_expert_id: expertId,
      p_question: question,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async answerConsultation(id: number, answer: string) {
    const { data, error } = await supabase.rpc('answer_consultation', {
      p_id: id,
      p_answer: answer,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async listMyConsultations() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('consultations')
      .select('*, customer:profiles!customer_id(nickname), expert:profiles!expert_id(nickname)')
      .or(`customer_id.eq.${uid},expert_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map((c: any) => ({
      id: c.id,
      customerId: c.customer_id,
      expertId: c.expert_id,
      price: c.price,
      question: c.question,
      answer: c.answer || '',
      status: c.status,
      customerName: c.customer?.nickname || '',
      expertName: c.expert?.nickname || '',
      createdAt: c.created_at,
      answeredAt: c.answered_at,
      isCustomer: String(c.customer_id) === String(uid),
    }));
  },

  async getMyWallet() {
    const { data, error } = await supabase.rpc('get_my_wallet');
    if (error) return null;
    return data && data.length > 0 ? data[0] : null;
  },

  // ---- Bounty（悬赏榜） ----
  async listBounties() {
    const { data } = await supabase
      .from('bounties')
      .select('*, profiles!owner_id(nickname), answers:bounty_answers(count)')
      .eq('status', 'open')
      .eq('hidden', false)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data || []).map((b: any) => ({
      id: b.id,
      ownerId: b.owner_id,
      ownerName: b.profiles?.nickname || '',
      title: b.title,
      content: b.content,
      totalAmount: b.total_amount || 0,
      answerCount: Array.isArray(b.answers) && b.answers.length > 0 ? (b.answers[0]?.count ?? 0) : 0,
      createdAt: b.created_at,
    }));
  },

  async getBounty(id: number) {
    const { data: b } = await supabase
      .from('bounties')
      .select('*, profiles!owner_id(nickname)')
      .eq('id', id)
      .single();
    if (!b) throw new Error('悬赏不存在');
    const { data: answers } = await supabase
      .from('bounty_answers')
      .select('*, profiles!user_id(nickname, avatar, realm)')
      .eq('bounty_id', id)
      .order('like_count', { ascending: false });
    return {
      id: b.id,
      ownerId: b.owner_id,
      ownerName: b.profiles?.nickname || '',
      title: b.title,
      content: b.content,
      totalAmount: b.total_amount || 0,
      status: b.status,
      acceptedAnswerId: b.accepted_answer_id,
      createdAt: b.created_at,
      answers: (answers || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        authorName: a.profiles?.nickname || '',
        authorAvatar: a.profiles?.avatar || '',
        authorRealm: a.profiles?.realm || '',
        content: a.content,
        likeCount: a.like_count || 0,
        payoutAmount: a.payout_amount || 0,
        status: a.status,
        createdAt: a.created_at,
      })),
    };
  },

  async createBountyFromConsultation(cid: number) {
    const { data, error } = await supabase.rpc('create_bounty_from_consultation', { p_cid: cid });
    if (error) throw new Error(error.message);
    return data;
  },

  async addBountyMoney(bid: number, amount: number) {
    const { data, error } = await supabase.rpc('add_bounty_money', { p_bid: bid, p_amount: amount });
    if (error) throw new Error(error.message);
    return data;
  },

  async answerBounty(bid: number, content: string) {
    const { data, error } = await supabase.rpc('answer_bounty', { p_bid: bid, p_content: content });
    if (error) throw new Error(error.message);
    return data;
  },

  async acceptBountyAnswer(bid: number, aid: number) {
    const { data, error } = await supabase.rpc('accept_bounty_answer', { p_bid: bid, p_aid: aid });
    if (error) throw new Error(error.message);
    return data;
  },

  async likeBountyAnswer(aid: number) {
    const { data, error } = await supabase.rpc('like_bounty_answer', { p_aid: aid });
    if (error) throw new Error(error.message);
    return data;
  },

  async getBountyRankings() {
    const { data, error } = await supabase.rpc('get_bounty_rankings');
    if (error) return [];
    return data || [];
  },

  // ---- Checkin（签到赏金） ----
  async checkin() {
    const { data, error } = await supabase.rpc('checkin');
    if (error) throw new Error(error.message);
    return data;
  },

  async getMyCheckin() {
    const { data, error } = await supabase.rpc('get_my_checkin');
    if (error) return null;
    return data && data.length > 0 ? data[0] : null;
  },

  async getMyBalanceLogs() {
    const { data, error } = await supabase.rpc('get_my_balance_logs');
    if (error) return [];
    return data || [];
  },

  // ---- 悬赏隐藏/删除/恢复 ----
  async hideBounty(bid: number) {
    const { data, error } = await supabase.rpc('hide_bounty', { p_bid: bid });
    if (error) throw new Error(error.message);
    return data;
  },

  async unhideBounty(bid: number) {
    const { data, error } = await supabase.rpc('unhide_bounty', { p_bid: bid });
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteBounty(bid: number) {
    const { data, error } = await supabase.rpc('delete_bounty', { p_bid: bid });
    if (error) throw new Error(error.message);
    return data;
  },

  async restoreBounty(bid: number) {
    const { data, error } = await supabase.rpc('restore_bounty', { p_bid: bid });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 回收箱：我删除的问题(软删 status='deleted') ----
  async getMyTrashedQuestions() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('user_id', uid)
      .eq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map(mapQuestion);
  },

  async deleteQuestionSoft(id: number) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const { error } = await supabase.from('questions').update({ status: 'deleted' }).eq('id', id).eq('user_id', uid);
    if (error) throw new Error(error.message);
  },

  async restoreQuestion(id: number) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const { error } = await supabase.from('questions').update({ status: 'active' }).eq('id', id).eq('user_id', uid);
    if (error) throw new Error(error.message);
  },

  // ---- 回收箱：我删除的悬赏 ----
  async getMyTrashedBounties() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('bounties')
      .select('*')
      .eq('owner_id', uid)
      .eq('deleted', true)
      .order('deleted_at', { ascending: false })
      .limit(100);
    return (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      totalAmount: b.total_amount || 0,
      deletedAt: b.deleted_at,
      createdAt: b.created_at,
    }));
  },

  // ---- Messages ----
  async getMessages() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const messages: any[] = [];

    // 官方消息（数据库公告表；未建表时容错跳过）
    try {
      const { data: anns } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(10);
      for (const a of (anns || [])) {
        const { data: rd } = await supabase.from('read_messages').select('id').eq('user_id', uid).eq('message_key', `ann_${a.id}`).maybeSingle();
        messages.push({
          id: 'ann_' + a.id,
          type: 'official',
          content: `${a.title}：${a.content}`,
          userId: null,
          userName: '修仙问答官方',
          userAvatar: '',
          createdAt: a.created_at,
          read: !!rd,
        });
      }
    } catch { /* announcements 表未创建时忽略 */ }

    // 新粉丝
    const { data: follows } = await supabase
      .from('follows')
      .select('id, follower_id, created_at, profiles!follower_id(nickname, avatar)')
      .eq('following_id', uid);
    for (const f of (follows || [])) {
      const { data: rd } = await supabase.from('read_messages').select('id').eq('user_id', uid).eq('message_key', `follow_${f.id}`).maybeSingle();
      messages.push({
        id: 'follow_' + f.id,
        type: 'follow',
        content: `${(f.profiles as any)?.nickname} 关注了你`,
        userId: f.follower_id,
        userName: (f.profiles as any)?.nickname,
        userAvatar: (f.profiles as any)?.avatar,
        createdAt: f.created_at,
        read: !!rd,
      });
    }

    // 我的回答被点赞
    const myAnswerIds = (await supabase.from('answers').select('id').eq('user_id', uid)).data?.map((a: any) => a.id) || [];
    if (myAnswerIds.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('id, user_id, target_id, created_at, profiles!user_id(nickname, avatar)')
        .eq('target_type', 'answer')
        .in('target_id', myAnswerIds);
      for (const l of (likes || [])) {
        const { data: rd } = await supabase.from('read_messages').select('id').eq('user_id', uid).eq('message_key', `like_${l.id}`).maybeSingle();
        messages.push({
          id: 'like_' + l.id,
          type: 'like',
          content: `${(l.profiles as any)?.nickname} 赞了你的回答`,
          userId: l.user_id,
          userName: (l.profiles as any)?.nickname,
          userAvatar: (l.profiles as any)?.avatar,
          targetId: l.target_id,
          createdAt: l.created_at,
          read: !!rd,
        });
      }
    }

    // 我的问题被回答
    const myQuestionIds = (await supabase.from('questions').select('id').eq('user_id', uid)).data?.map((q: any) => q.id) || [];
    if (myQuestionIds.length > 0) {
      const { data: answers } = await supabase
        .from('answers')
        .select('id, user_id, question_id, created_at, profiles!user_id(nickname, avatar)')
        .in('question_id', myQuestionIds);
      for (const a of (answers || [])) {
        const { data: rd } = await supabase.from('read_messages').select('id').eq('user_id', uid).eq('message_key', `answer_${a.id}`).maybeSingle();
        messages.push({
          id: 'answer_' + a.id,
          type: 'answer',
          content: `${(a.profiles as any)?.nickname} 回答了你的问题`,
          userId: a.user_id,
          userName: (a.profiles as any)?.nickname,
          userAvatar: (a.profiles as any)?.avatar,
          targetId: a.question_id,
          createdAt: a.created_at,
          read: !!rd,
        });
      }
    }

    // 邀请回答（invites 表；未建表时容错跳过）
    try {
      const { data: invites } = await supabase
        .from('invites')
        .select('id, question_id, created_at, profiles!inviter_id(nickname, avatar)')
        .eq('invitee_id', uid);
      for (const iv of (invites || [])) {
        const { data: rd } = await supabase.from('read_messages').select('id').eq('user_id', uid).eq('message_key', `invite_${iv.id}`).maybeSingle();
        messages.push({
          id: 'invite_' + iv.id,
          type: 'invite',
          content: `${(iv.profiles as any)?.nickname} 邀请你回答问题`,
          userId: (iv as any).inviter_id,
          userName: (iv.profiles as any)?.nickname,
          userAvatar: (iv.profiles as any)?.avatar,
          targetId: iv.question_id,
          createdAt: iv.created_at,
          read: !!rd,
        });
      }
    } catch { /* invites 表未创建时忽略 */ }

    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return messages.slice(0, 50);
  },

  async markAllMessagesRead() {
    await supabase.rpc('mark_messages_read');
    return { success: true };
  },

  // ================ v13 实时通知（notifications 表；未建表时降级到旧聚合） ================

  // 旧 getMessages 聚合结果 → 统一通知结构（降级兼容用）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _mapMessageToNotification(m: any) {
    let link = '';
    switch (m.type) {
      case 'follow': link = m.userId ? `/user/${m.userId}` : ''; break;
      case 'like': link = m.targetId ? `/question/${m.targetId}` : '/messages/like'; break;
      case 'answer': link = m.targetId ? `/question/${m.targetId}` : '/messages/answer'; break;
      case 'invite': link = m.targetId ? `/question/${m.targetId}` : '/messages/invite'; break;
      case 'pm': link = m.userId ? `/messages/private/${m.userId}` : '/messages/private'; break;
      default: link = '/messages/official';
    }
    return {
      id: String(m.id),
      type: m.type,
      actorId: m.userId ? String(m.userId) : null,
      actorName: m.userName || '',
      actorAvatar: m.userAvatar || '',
      targetType: null,
      targetId: m.targetId ? String(m.targetId) : null,
      title: m.content || '',
      body: m.content || '',
      link,
      read: !!m.read,
      createdAt: m.createdAt,
    };
  },

  // 拉取通知（优先 notifications 表；失败降级到旧消息聚合）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getNotifications(limit = 50, offset = 0): Promise<any[]> {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, actor_id, target_type, target_id, title, body, link, read, created_at, profiles!actor_id(nickname, avatar)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (!error && data) {
        return data.map((n: any) => ({
          id: String(n.id),
          type: n.type,
          actorId: n.actor_id ? String(n.actor_id) : null,
          targetType: n.target_type,
          targetId: n.target_id ? String(n.target_id) : null,
          title: n.title,
          body: n.body,
          link: n.link,
          read: !!n.read,
          createdAt: n.created_at,
          actorName: (n.profiles as any)?.nickname || '道友',
          actorAvatar: (n.profiles as any)?.avatar || '',
        }));
      }
    } catch { /* 降级 */ }
    return [];
  },

  // 未读通知计数（优先 notifications 表；失败降级）
  async getUnreadNotificationCount(): Promise<number> {
    const uid = await getCurrentUserId();
    if (!uid) return 0;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false);
      if (!error && count != null) return count;
    } catch { /* 降级 */ }
    try {
      const msgs = await this.getMessages();
      return msgs.filter((m: any) => !m.read).length;
    } catch { return 0; }
  },

  // 标记单条已读
  async markNotificationRead(id: string | number) {
    const uid = await getCurrentUserId();
    if (!uid) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', Number(id))
        .eq('user_id', uid);
      if (!error) return;
    } catch { /* notifications 表可能未建 */ }
    // 降级：旧消息聚合的已读标记（按 message_key 写入 read_messages）
    try {
      await supabase.from('read_messages').insert({ user_id: uid, message_key: `notif_${id}` });
    } catch { /* ignore */ }
  },

  // 标记全部已读
  async markAllNotificationsRead() {
    const uid = await getCurrentUserId();
    if (!uid) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', uid)
        .eq('read', false);
      if (!error) return;
    } catch { /* notifications 表可能未建 */ }
    try { await supabase.rpc('mark_messages_read'); } catch { /* ignore */ }
  },

  // ---- Rankings ----
  async getRankings(realm?: string) {
    const { data } = await supabase
      .from('profiles_public')
      .select('*')
      .eq('realm', realm || 'huashen')
      .order('points', { ascending: false })
      .limit(10);
    return (data || []).map(mapUser);
  },

  // ---- 排行榜：按境界 RPC（v16 替代前端全量过滤，用户量大也不截断） ----
  async getRankingsByRealm(realm = 'huashen', limit = 50) {
    const { data, error } = await supabase.rpc('get_rankings_by_realm', { p_realm: realm, p_limit: limit });
    if (error) {
      // 迁移未执行时降级：走旧查询
      const { data: d2 } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('realm', realm)
        .order('points', { ascending: false })
        .limit(50);
      return (d2 || []).map(mapUser);
    }
    return (data || []).map(mapUser);
  },

  // ---- All users ----
  async getAllUsers() {
    // 公开用户列表走去敏视图 profiles_public（不含 phone）
    const { data } = await supabase
      .from('profiles_public')
      .select('*')
      .order('id')
      .limit(500);
    return (data || []).map(mapUser);
  },

  // ================ v11 社区版新增 ================

  // ---- 学校（392 所，公开） ----
  async listSchools() {
    const { data, error } = await supabase.rpc('list_schools');
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 匿名审核（后台） ----
  async listAnonymousReviews(status = 'pending') {
    const { data, error } = await supabase.rpc('list_anonymous_reviews', { p_status: status });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async reviewAnonymous(id: number, approve: boolean, reason = '') {
    const { error } = await supabase.rpc('review_anonymous', { p_review_id: id, p_approve: approve, p_reason: reason });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // ---- 自动审核复核（后台） ----
  async listContentReviews(status = 'pending') {
    const { data, error } = await supabase.rpc('list_content_reviews', { p_status: status });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async reviewContent(id: number, approve: boolean) {
    const { error } = await supabase.rpc('review_content', { p_review_id: id, p_approve: approve });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // ---- 自动审核规则管理（后台） ----
  async listAutoRules() {
    const { data } = await supabase.from('auto_review_rules').select('*').order('id');
    return data || [];
  },
  async saveAutoRule(keyword: string, action = 'hidden', enabled = true, id?: number) {
    if (id) {
      const { error } = await supabase.from('auto_review_rules').update({ keyword, action, enabled }).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('auto_review_rules').insert({ keyword, action, enabled });
      if (error) throw new Error(error.message);
    }
    return { success: true };
  },
  async deleteAutoRule(id: number) {
    const { error } = await supabase.from('auto_review_rules').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // ---- 赞赏（感谢=打赏，余额流转） ----
  async createTip(answerId: number, amount: number) {
    const { data, error } = await supabase.rpc('create_tip', { p_answer_id: answerId, p_amount: amount });
    if (error) throw new Error(error.message);
    return { success: !!data?.ok, amount };
  },

  // ---- 赞同者列表（仅答主/评论作者+管理员可见，服务端校验） ----
  async getLikers(targetType: 'answer' | 'comment', targetId: number) {
    const { data, error } = await supabase.rpc('get_likers', { p_target_type: targetType, p_target_id: targetId });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 收藏夹 ----
  async moveFavorite(questionId: number, folder: string) {
    const { error } = await supabase.rpc('move_favorite', { p_question_id: questionId, p_folder: folder });
    if (error) throw new Error(error.message);
    return { success: true };
  },
  async getFavoriteFolders() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase.from('favorites').select('folder').eq('user_id', uid);
    return [...new Set((data || []).map((f: any) => f.folder || '默认收藏'))];
  },
  async getMyFavoritesWithFolder() {
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data } = await supabase
      .from('favorites')
      .select('folder, questions(*, profiles!user_id(nickname))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    return (data || []).map((f: any) => f.questions ? {
      ...mapQuestion(f.questions),
      folder: f.folder || '默认收藏',
      authorName: (f.questions.profiles as any)?.nickname,
    } : null).filter(Boolean);
  },

  // ---- 关注动态流（我关注的人的新回答） ----
  async getFollowFeed(offset = 0, limit = 20) {
    const { data, error } = await supabase.rpc('get_follow_feed', { p_offset: offset, p_limit: limit });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 本校热门 ----
  async getSchoolFeed(schoolId: number, offset = 0, limit = 20) {
    const { data, error } = await supabase.rpc('get_school_feed', { p_school_id: schoolId, p_offset: offset, p_limit: limit });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 我的收益（赞赏/咨询/悬赏/余额） ----
  async getMyEarnings() {
    const { data, error } = await supabase.rpc('get_my_earnings');
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 个人偏好（隐藏主页 / 个性化推荐开关） ----
  async updatePrefs(prefs: { hideContent?: boolean; enablePersonalized?: boolean }) {
    const uid = await getCurrentUserId();
    if (!uid) throw new Error('请先登录');
    const patch: any = {};
    if (typeof prefs.hideContent === 'boolean') patch.hide_content = prefs.hideContent;
    if (typeof prefs.enablePersonalized === 'boolean') patch.enable_personalized = prefs.enablePersonalized;
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  // ---- 查询某用户是否隐藏了主页内容 ----
  async getUserHideContent(userId: string | number) {
    const { data } = await supabase.from('profiles').select('hide_content').eq('id', String(userId)).maybeSingle();
    return !!data?.hide_content;
  },

  // ---- 保存我的学校（v16：统一圈子绑定） ----
  async saveMySchool(schoolId: number) {
    const { data, error } = await supabase.rpc('save_my_school', { p_school_id: schoolId });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 学校认证（v18） ----
  async applySchoolVerification(schoolId: number, reason = '') {
    const { data, error } = await supabase.rpc('apply_school_verification', { p_school_id: schoolId, p_reason: reason });
    if (error) throw new Error(error.message);
    return data;
  },
  async getMyVerification() {
    const { data, error } = await supabase.rpc('get_my_verification');
    if (error) throw new Error(error.message);
    return data;
  },
  async listVerifiedMembers(schoolId: number, limit = 20) {
    const { data, error } = await supabase.rpc('list_verified_members', { p_school_id: schoolId, p_limit: limit });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 问题悬赏 + 邀请回答（v19） ----
  async createBountyForQuestion(questionId: number, amount: number) {
    const { data, error } = await supabase.rpc('create_bounty_for_question', { p_question_id: questionId, p_amount: amount });
    if (error) throw new Error(error.message);
    return data;
  },
  async addBountyAmountByQuestion(questionId: number, amount: number) {
    const { data, error } = await supabase.rpc('add_bounty_amount_by_question', { p_question_id: questionId, p_amount: amount });
    if (error) throw new Error(error.message);
    return data;
  },
  async inviteUser(questionId: number, userId: string) {
    const { data, error } = await supabase.rpc('invite_user', { p_question_id: questionId, p_user_id: userId });
    if (error) throw new Error(error.message);
    return data;
  },
  async inviteVerifiedMembers(questionId: number, schoolId: number) {
    const { data, error } = await supabase.rpc('invite_verified_members', { p_question_id: questionId, p_school_id: schoolId });
    if (error) throw new Error(error.message);
    return data;
  },
  async listMyInvites(limit = 50) {
    const { data, error } = await supabase.rpc('list_my_invites', { p_limit: limit });
    if (error) throw new Error(error.message);
    return data || [];
  },
};
