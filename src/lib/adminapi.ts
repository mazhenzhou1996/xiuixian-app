// 管理后台 API 层
// 所有写操作自动写入 admin_change_log，可通过「变更日志」一键回滚
import { supabase } from './supabase';

async function getAdminId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!data?.is_admin) throw new Error('无管理员权限');
  return user.id;
}

export const adminApi = {
  // ---- 权限 ----
  async checkAdmin(): Promise<boolean> {
    try { await getAdminId(); return true; } catch { return false; }
  },

  // ---- 变更日志（所有写操作统一入口） ----
  async log(table: string, recordId: number, action: string, before: any, after: any, note = '') {
    const adminId = await getAdminId();
    await supabase.from('admin_change_log').insert({
      admin_id: adminId,
      table_name: table,
      record_id: recordId,
      action,
      before: before || null,
      after: after || null,
      note,
    });
  },

  async listChangeLogs() {
    await getAdminId();
    const { data } = await supabase
      .from('admin_change_log')
      .select('*, profiles!admin_id(nickname)')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map((l: any) => ({
      id: l.id,
      tableName: l.table_name,
      recordId: l.record_id,
      action: l.action,
      before: l.before,
      after: l.after,
      note: l.note,
      adminName: l.profiles?.nickname || '',
      createdAt: l.created_at,
    }));
  },

  async rollback(changeId: number): Promise<string> {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_rollback', { change_id: changeId });
    if (error) throw new Error(error.message);
    return data || '已回滚';
  },

  // ---- 统计 ----
  async getStats() {
    await getAdminId();
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('universities').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('answers').select('id', { count: 'exact', head: true }),
      supabase.from('topic_services').select('id', { count: 'exact', head: true }),
    ]);
    return {
      reports: r1.count || 0,
      pendingReports: r2.count || 0,
      universities: r3.count || 0,
      questions: r4.count || 0,
      answers: r5.count || 0,
      services: r6.count || 0,
    };
  },

  // 看板聚合（v14）：走 admin_dashboard_stats RPC；表缺失时降级直接计数
  async getDashboardStats() {
    try {
      const { data, error } = await supabase.rpc('admin_dashboard_stats');
      if (!error && data && !(data as any).error) return data as any;
    } catch { /* RPC 未部署则降级 */ }
    try {
      const [qc, ac, uc, sc] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('answers').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('universities').select('id', { count: 'exact', head: true }),
      ]);
      return {
        totals: { questions: qc.count || 0, answers: ac.count || 0, users: uc.count || 0, schools: sc.count || 0 },
        daily: [], status: {}, topSchools: [],
      };
    } catch { return null; }
  },

  // ---- 举报审核 ----
  async listReports(status?: string) {
    await getAdminId();
    let q = supabase
      .from('reports')
      .select('*, profiles!reporter_id(nickname)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map((r: any) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      targetUserId: r.target_user_id,
      reason: r.reason,
      content: r.content,
      status: r.status,
      reporterName: r.profiles?.nickname || '',
      createdAt: r.created_at,
    }));
  },

  async setReportStatus(id: number, status: string) {
    await getAdminId();
    const { error } = await supabase.from('reports').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async setContentStatus(type: 'question' | 'answer' | 'comment', id: string | number, status: 'active' | 'hidden') {
    await getAdminId();
    const table = type === 'question' ? 'questions' : type === 'answer' ? 'answers' : 'comments';
    const { error } = await supabase.from(table).update({ status }).eq('id', Number(id));
    if (error) throw new Error(error.message);
  },

  async getContentStatus(type: 'question' | 'answer', id: string | number): Promise<string> {
    const table = type === 'question' ? 'questions' : 'answers';
    const { data } = await supabase.from(table).select('status').eq('id', Number(id)).maybeSingle();
    return data?.status || 'active';
  },

  // ---- 高校管理 ----
  async listUniversities(keyword?: string) {
    await getAdminId();
    let q = supabase.from('universities').select('*').order('sort_order', { ascending: true }).order('id').limit(5000);
    if (keyword) q = q.or(`name.ilike.%${keyword}%,province.ilike.%${keyword}%,city.ilike.%${keyword}%`);
    const { data } = await q;
    return data || [];
  },

  async getUniversityById(id: number) {
    await getAdminId();
    const { data } = await supabase.from('universities').select('*').eq('id', id).maybeSingle();
    return data || null;
  },

  async saveUniversity(u: any, isNew: boolean) {
    await getAdminId();
    const payload = {
      name: u.name,
      province: u.province || '',
      city: u.city || '',
      level: u.level || 'other',
      tags: u.tags || [],
      qs: u.qs || '',
      address: u.address || '',
      intro: u.intro || '',
      pay_text: u.pay_text || '付费咨询学长学姐',
      hot_label: u.hot_label || '本校热门',
      sort_order: u.sort_order || 0,
      enabled: u.enabled !== false,
      updated_at: new Date().toISOString(),
    };
    let before: any = null;
    let recordId: number;
    let action = 'create';
    if (!isNew) {
      const { data: old } = await supabase.from('universities').select('*').eq('id', u.id).single();
      before = old || null;
      action = 'update';
    }
    if (isNew) {
      // 名称已存在则走更新
      const { data: dup } = await supabase.from('universities').select('id').eq('name', u.name).maybeSingle();
      if (dup) {
        const { data: old } = await supabase.from('universities').select('*').eq('id', dup.id).single();
        before = old || null;
        action = 'update';
        const { data: upd, error } = await supabase.from('universities').update(payload).eq('id', dup.id).select().single();
        if (error) throw new Error(error.message);
        recordId = dup.id;
        await this.log('universities', recordId, action, before, upd, isNew ? '导入更新' : '编辑');
        return upd;
      }
      const { data: ins, error } = await supabase.from('universities').insert(payload).select().single();
      if (error) throw new Error(error.message);
      recordId = ins.id;
      await this.log('universities', recordId, action, before, ins, '新增');
      return ins;
    }
    const { data: upd, error } = await supabase.from('universities').update(payload).eq('id', u.id).select().single();
    if (error) throw new Error(error.message);
    recordId = upd.id;
    await this.log('universities', recordId, action, before, upd, '编辑');
    return upd;
  },

  async deleteUniversity(id: number) {
    await getAdminId();
    const { data: old } = await supabase.from('universities').select('*').eq('id', id).single();
    const { error } = await supabase.from('universities').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await this.log('universities', id, 'delete', old, null, '删除');
  },

  async toggleUniversity(id: number, enabled: boolean) {
    await getAdminId();
    const { data: old } = await supabase.from('universities').select('*').eq('id', id).single();
    const { data: upd, error } = await supabase
      .from('universities')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.log('universities', id, 'update', old, upd, enabled ? '启用' : '停用');
    return upd;
  },

  // 批量导入：rows 与模板同构，name 已存在则更新，否则新增
  async importUniversities(rows: any[]): Promise<{ added: number; updated: number; failed: number; errors: string[] }> {
    await getAdminId();
    let added = 0, updated = 0, failed = 0;
    const errors: string[] = [];
    for (const r of rows) {
      try {
        if (!r.name || !String(r.name).trim()) { failed++; errors.push('缺少 name 字段'); continue; }
        const u = {
          name: String(r.name).trim(),
          province: String(r.province || '').trim(),
          city: String(r.city || '').trim(),
          level: r.level || 'other',
          tags: Array.isArray(r.tags) ? r.tags.map(String) : String(r.tags || '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean),
          qs: String(r.qs || '').trim(),
          address: String(r.address || '').trim(),
          intro: String(r.intro || '').trim(),
          pay_text: String(r.pay_text || '付费咨询学长学姐').trim(),
          hot_label: String(r.hot_label || '本校热门').trim(),
          sort_order: Number(r.sort_order || 0),
          enabled: r.enabled !== false,
        };
        const { data: dup } = await supabase.from('universities').select('id').eq('name', u.name).maybeSingle();
        if (dup) {
          const { data: old } = await supabase.from('universities').select('*').eq('id', dup.id).single();
          const { data: upd, error } = await supabase.from('universities').update({ ...u, updated_at: new Date().toISOString() }).eq('id', dup.id).select().single();
          if (error) throw error;
          await this.log('universities', dup.id, 'update', old, upd, '批量导入-更新');
          updated++;
        } else {
          const { data: ins, error } = await supabase.from('universities').insert(u).select().single();
          if (error) throw error;
          await this.log('universities', ins.id, 'create', null, ins, '批量导入-新增');
          added++;
        }
      } catch (e: any) {
        failed++;
        errors.push(`${r.name || '?'}: ${e.message}`);
      }
    }
    return { added, updated, failed, errors };
  },

  // ---- 九宫格服务管理 ----
  async listServices(topic: string) {
    await getAdminId();
    const { data } = await supabase
      .from('topic_services')
      .select('*')
      .eq('topic', topic)
      .order('sort_order', { ascending: true })
      .limit(200);
    return data || [];
  },

  async saveService(s: any, isNew: boolean) {
    await getAdminId();
    const payload = {
      topic: s.topic,
      label: s.label,
      icon: s.icon || 'Sparkles',
      url: s.url || '',
      description: s.description || '',
      ad_unlock: !!s.ad_unlock,
      sort_order: s.sort_order || 0,
      enabled: s.enabled !== false,
    };
    let before: any = null;
    let recordId: number;
    let action = 'create';
    if (!isNew) {
      const { data: old } = await supabase.from('topic_services').select('*').eq('id', s.id).single();
      before = old || null;
      action = 'update';
    }
    if (isNew) {
      const { data: ins, error } = await supabase.from('topic_services').insert(payload).select().single();
      if (error) throw new Error(error.message);
      recordId = ins.id;
      await this.log('topic_services', recordId, action, before, ins, '新增');
      return ins;
    }
    const { data: upd, error } = await supabase.from('topic_services').update(payload).eq('id', s.id).select().single();
    if (error) throw new Error(error.message);
    recordId = upd.id;
    await this.log('topic_services', recordId, action, before, upd, '编辑');
    return upd;
  },

  async deleteService(id: number) {
    await getAdminId();
    const { data: old } = await supabase.from('topic_services').select('*').eq('id', id).single();
    const { error } = await supabase.from('topic_services').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await this.log('topic_services', id, 'delete', old, null, '删除');
  },

  async toggleService(id: number, enabled: boolean) {
    await getAdminId();
    const { data: old } = await supabase.from('topic_services').select('*').eq('id', id).single();
    const { data: upd, error } = await supabase.from('topic_services').update({ enabled }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    await this.log('topic_services', id, 'update', old, upd, enabled ? '启用' : '停用');
    return upd;
  },

  // ---- 专题配置 ----
  async getTopicConfig(topic: string) {
    await getAdminId();
    const { data } = await supabase.from('topic_configs').select('*').eq('topic', topic).maybeSingle();
    return data || null;
  },

  async saveTopicConfig(cfg: any) {
    await getAdminId();
    const { data: old } = await supabase.from('topic_configs').select('*').eq('topic', cfg.topic).maybeSingle();
    const payload = {
      title: cfg.title || '',
      hot_label: cfg.hot_label || '',
      pay_text: cfg.pay_text || '',
      enabled: cfg.enabled !== false,
      updated_at: new Date().toISOString(),
    };
    if (old) {
      const { data: upd, error } = await supabase.from('topic_configs').update(payload).eq('id', old.id).select().single();
      if (error) throw new Error(error.message);
      await this.log('topic_configs', old.id, 'update', old, upd, '编辑专题配置');
      return upd;
    }
    const { data: ins, error } = await supabase.from('topic_configs').insert({ topic: cfg.topic, ...payload }).select().single();
    if (error) throw new Error(error.message);
    await this.log('topic_configs', ins.id, 'create', null, ins, '新增专题配置');
    return ins;
  },

  // ---- 内容管理 ----
  async listContent(type: 'question' | 'answer', keyword?: string) {
    await getAdminId();
    const table = type === 'question' ? 'questions' : 'answers';
    let q = supabase
      .from(table)
      .select('*, profiles!user_id(nickname)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (keyword) {
      q = type === 'question'
        ? q.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
        : q.or(`content.ilike.%${keyword}%`);
    }
    const { data } = await q;
    return (data || []).map((r: any) => ({
      id: r.id,
      title: r.title || '',
      content: r.content || '',
      status: r.status || 'active',
      authorName: r.profiles?.nickname || '',
      userId: r.user_id || null,
      createdAt: r.created_at,
      ...(type === 'answer' ? { questionId: r.question_id } : {}),
    }));
  },

  // ---- 评论管理(管理端,含已下架) ----
  async listComments(keyword?: string) {
    await getAdminId();
    let q = supabase
      .from('comments')
      .select('*, profiles!user_id(nickname), answers!answer_id(question_id)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (keyword) q = q.ilike('content', `%${keyword}%`);
    const { data } = await q;
    return (data || []).map((r: any) => ({
      id: r.id,
      content: r.content || '',
      status: r.status || 'active',
      authorName: r.profiles?.nickname || '',
      userId: r.user_id || null,
      questionId: r.answers?.question_id ?? null,
      createdAt: r.created_at,
    }));
  },

  // ---- 真删除(级联清理点赞/收藏/关注/评论/举报) ----
  async adminDeleteContent(type: 'question' | 'answer' | 'comment', id: number | string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_delete_content', {
      t_type: type,
      t_id: Number(id),
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 用户管理 ----
  async adminListUsers(keyword?: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_users', { kw: keyword || '' });
    if (error) throw new Error(error.message);
    return (data || []).map((u: any) => ({
      id: u.id,
      phone: u.phone || '',
      nickname: u.nickname || '',
      avatar: u.avatar || '',
      realm: u.realm || '',
      points: u.points || 0,
      credit: u.credit ?? 100,
      isAdmin: !!u.is_admin,
      createdAt: u.created_at,
      penaltyType: u.penalty_type || null,
      penaltyUntil: u.penalty_until || null,
      penaltyReason: u.penalty_reason || '',
      penaltyId: u.penalty_id || null,
      balance: u.balance || 0,
    }));
  },

  async adminListPenalties(uid: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_penalties', { p_uid: uid });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async penalizeUser(uid: string, type: 'mute' | 'ban', durationHours: number, until: string | null, reason: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_penalize_user', {
      p_uid: uid,
      p_type: type,
      p_duration_hours: durationHours,
      p_until: until,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async revokePenalty(penaltyId: number | string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_revoke_penalty', { p_id: Number(penaltyId) });
    if (error) throw new Error(error.message);
    return data;
  },

  async setAdminRole(uid: string, isAdmin: boolean) {
    await getAdminId();
    const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', uid);
    if (error) throw new Error(error.message);
  },

  // ---- 申诉处理 ----
  async listAppeals(status?: string) {
    await getAdminId();
    let q = supabase
      .from('appeals')
      .select('*, profiles!user_id(nickname, phone)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map((a: any) => ({
      id: a.id,
      penaltyId: a.penalty_id,
      reason: a.reason,
      status: a.status,
      adminReply: a.admin_reply || '',
      userNickname: a.profiles?.nickname || '',
      userPhone: a.profiles?.phone || '',
      createdAt: a.created_at,
    }));
  },

  async reviewAppeal(id: number, status: string, reply: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_review_appeal', {
      p_id: id,
      p_status: status,
      p_reply: reply,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 晋级审核 ----
  async listPromotions(status?: string) {
    await getAdminId();
    let q = supabase
      .from('promotion_requests')
      .select('*, profiles!user_id(nickname, phone, points)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      fromRealm: r.from_realm,
      fromStage: r.from_stage,
      toRealm: r.to_realm,
      toStage: r.to_stage,
      toName: r.to_name,
      status: r.status,
      adminReply: r.admin_reply || '',
      nickname: r.profiles?.nickname || '',
      phone: r.profiles?.phone || '',
      points: r.profiles?.points || 0,
      createdAt: r.created_at,
    }));
  },

  async reviewPromotion(id: number, approve: boolean, reply: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_review_promotion', {
      p_id: id,
      p_approve: approve,
      p_reply: reply,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 付费咨询管理 ----
  async adminListConsultations(status?: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_consultations', { p_status: status || '' });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async refundConsultation(id: number, reason: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('refund_consultation', { p_id: id, p_reason: reason });
    if (error) throw new Error(error.message);
    return data;
  },

  async setBalance(uid: string, delta: number, reason: string) {
    await getAdminId();
    if (!reason.trim()) throw new Error('请填写原因');
    const { data, error } = await supabase
      .from('profiles')
      .update({ balance: Math.max(0, delta) })
      .eq('id', uid)
      .select('balance')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 赏金管理(发放/去除,封顶100,记流水) ----
  async grantBalance(uid: string, amount: number, reason: string) {
    await getAdminId();
    if (!reason.trim()) throw new Error('请填写原因');
    const { data, error } = await supabase.rpc('admin_grant_balance', {
      p_uid: uid,
      p_amount: amount,
      p_reason: reason.trim(),
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminBalanceLogs(uid: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_balance_logs', { p_uid: uid });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 高校服务内容管理 ----
  async listServiceContentsForUni(uniId: number, topic: string) {
    await getAdminId();
    const { data: services } = await supabase
      .from('topic_services')
      .select('*')
      .eq('topic', topic)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    const { data: contents } = await supabase
      .from('service_contents')
      .select('*')
      .eq('university_id', uniId);
    const map = new Map((contents || []).map((c: any) => [c.service_id, c]));
    return (services || []).map((s: any) => ({
      service: { id: s.id, label: s.label, icon: s.icon },
      content: map.get(s.id)?.content || '',
      netdiskUrl: map.get(s.id)?.netdisk_url || '',
      adUnlock: !!map.get(s.id)?.ad_unlock,
    }));
  },

  async saveServiceContent(uniId: number, serviceId: number, content: string, netdiskUrl: string, adUnlock = false) {
    await getAdminId();
    const { data, error } = await supabase
      .from('service_contents')
      .upsert({
        university_id: uniId,
        service_id: serviceId,
        content: content || '',
        netdisk_url: netdiskUrl || '',
        ad_unlock: !!adUnlock,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'university_id,service_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async bulkImportContents(rows: any[]) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_bulk_import_contents', { rows });
    if (error) throw new Error(error.message);
    return data;
  },

  async exportAllContents() {
    await getAdminId();
    const { data } = await supabase
      .from('service_contents')
      .select('*, universities!university_id(name), topic_services!service_id(label, topic)')
      .limit(5000);
    return (data || []).map((c: any) => ({
      university: c.universities?.name || '',
      topic: c.topic_services?.topic || 'university',
      service: c.topic_services?.label || '',
      content: c.content || '',
      netdisk_url: c.netdisk_url || '',
    }));
  },

  // ---- 信誉系统（量化扣分） ----
  async deductCredit(uid: string, delta: number, reason: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_deduct_credit', {
      p_uid: uid,
      p_delta: delta,
      p_reason: reason,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminListCreditLogs(uid: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_credit_logs', { p_uid: uid });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ---- 运营公告 ----
  async listAnnouncements() {
    await getAdminId();
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles!created_by(nickname)')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      enabled: a.enabled !== false,
      authorName: a.profiles?.nickname || '',
      createdAt: a.created_at,
    }));
  },

  async saveAnnouncement(a: any, isNew: boolean) {
    await getAdminId();
    const payload = { title: a.title, content: a.content, enabled: a.enabled !== false };
    if (isNew) {
      const { data, error } = await supabase.from('announcements').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase.from('announcements').update(payload).eq('id', a.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteAnnouncement(id: number) {
    await getAdminId();
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async toggleAnnouncement(id: number, enabled: boolean) {
    await getAdminId();
    const { error } = await supabase.from('announcements').update({ enabled }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ---- 当前用户惩罚(写操作前校验) ----
  async getMyPenalty() {
    const { data, error } = await supabase.rpc('get_my_penalty');
    if (error) return null;
    return data || null;
  },
  // ---- 学校认证审核（v18） ----
  async listSchoolVerifications(status = 'pending') {
    await getAdminId();
    const { data, error } = await supabase.rpc('list_school_verifications', { p_status: status });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async reviewSchoolVerification(id: number, approve: boolean, reason = '') {
    await getAdminId();
    const { data, error } = await supabase.rpc('review_school_verification', { p_id: id, p_approve: approve, p_reason: reason });
    if (error) throw new Error(error.message);
    return data;
  },

  // ---- 失物/悬赏管理（v27） ----
  async adminListLost(status = 'all') {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_lost', { p_status: status });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async adminCloseLost(id: number) {
    await getAdminId();
    const { error } = await supabase.rpc('admin_close_lost', { p_item_id: id });
    if (error) throw new Error(error.message);
    return { ok: true };
  },
  async adminListBounties(type = 'all') {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_list_bounties', { p_bounty_type: type });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async adminCloseBounty(id: number) {
    await getAdminId();
    const { error } = await supabase.rpc('admin_close_bounty', { p_bounty_id: id });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ---- 表白墙管理（v31） ----
  async adminListConfessions(status?: string) {
    await getAdminId();
    let q = supabase
      .from('confessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((c: any) => ({
      id: c.id,
      userId: c.user_id,
      toName: c.to_name || '',
      content: c.content || '',
      isAnonymous: !!c.is_anonymous,
      image: c.image || '',
      schoolId: c.school_id,
      amount: c.amount ?? 1,
      likeCount: c.like_count || 0,
      featured: !!c.featured,
      pinned: !!c.pinned,
      status: c.status || 'active',
      storyUpdate: c.story_update || '',
      confirmedAt: c.confirmed_at || null,
      acceptedAt: c.accepted_at || null,
      posterConfirmedAt: c.poster_confirmed_at || null,
      createdAt: c.created_at,
    }));
  },

  async adminDeleteConfession(id: number) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_delete_confession', { p_id: id });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  },

  async adminPinConfession(id: number, days = 1) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_pin_confession', { p_id: id, p_days: days });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  },

  async adminFeatureConfession(id: number, days = 1) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_feature_confession', { p_id: id, p_days: days });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  },

  async adminRejectConfession(id: number) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_reject_confession', { p_id: id });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  },

  async adminUpdateConfession(id: number, content: string, toName: string) {
    await getAdminId();
    const { data, error } = await supabase.rpc('admin_update_confession', {
      p_id: id, p_content: content, p_to_name: toName,
    });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) throw new Error((data as any).error);
    return data;
  },
};


// ---- 公共（前台）专题数据接口 ----
export const publicTopic = {
  async getUniversities() {
    const { data } = await supabase
      .from('universities')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id')
      .limit(3000);
    return data || [];
  },

  async getServices(topic: string) {
    const { data } = await supabase
      .from('topic_services')
      .select('*')
      .eq('topic', topic)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    return data || [];
  },

  async getTopicConfig(topic: string) {
    const { data } = await supabase
      .from('topic_configs')
      .select('*')
      .eq('topic', topic)
      .eq('enabled', true)
      .maybeSingle();
    return data || null;
  },

  // 单个服务详情
  async getServiceById(serviceId: number) {
    const { data } = await supabase
      .from('topic_services')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();
    return data || null;
  },

  // 某高校某服务的内容(文字 + 网盘链接)
  async getServiceContent(universityId: number, serviceId: number) {
    const { data } = await supabase
      .from('service_contents')
      .select('*')
      .eq('university_id', universityId)
      .eq('service_id', serviceId)
      .maybeSingle();
    return data || null;
  },

  // 前台公告(消息中心官方消息来源)
  async getAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, content, created_at')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  },
};
