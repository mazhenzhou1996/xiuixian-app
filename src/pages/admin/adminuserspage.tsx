import { useState, useEffect } from 'react';
import { Search, Loader2, Ban, MicOff, Mic, Shield, ShieldOff, RotateCcw, History, ShieldCheck, Coins } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime, REALM_LABELS } from '@/utils/format';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const MUTE_OPTIONS = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '1 天', hours: 24 },
  { label: '7 天', hours: 168 },
  { label: '30 天', hours: 720 },
  { label: '永久', hours: 0 },
];

export default function AdminUsersPage() {
  const [tab, setTab] = useState<'users' | 'appeals' | 'promotions'>('users');
  const [list, setList] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [penaltyUser, setPenaltyUser] = useState<any | null>(null);
  const [penaltyType, setPenaltyType] = useState<'mute' | 'ban'>('mute');
  const [penaltyHours, setPenaltyHours] = useState(24);
  const [penaltyReason, setPenaltyReason] = useState('');
  const [penaltyDays, setPenaltyDays] = useState(7);
  const [historyUser, setHistoryUser] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [replyMap, setReplyMap] = useState<Record<number, string>>({});
  const [promoReplyMap, setPromoReplyMap] = useState<Record<number, string>>({});
  // 信誉系统
  const [creditUser, setCreditUser] = useState<any | null>(null);
  const [creditDelta, setCreditDelta] = useState(-10);
  const [creditReason, setCreditReason] = useState('');
  const [creditLogsUser, setCreditLogsUser] = useState<any | null>(null);
  const [creditLogs, setCreditLogs] = useState<any[]>([]);
  // 赏金管理
  const [goldUser, setGoldUser] = useState<any | null>(null);
  const [goldAmount, setGoldAmount] = useState(10);
  const [goldReason, setGoldReason] = useState('');
  const [goldLogs, setGoldLogs] = useState<any[]>([]);

  const load = async (kw?: string) => {
    setLoading(true);
    try {
      setList(await adminApi.adminListUsers(kw));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAppeals = async () => {
    setLoading(true);
    try {
      setAppeals(await adminApi.listAppeals());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    setLoading(true);
    try {
      setPromotions(await adminApi.listPromotions());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') load();
    else if (tab === 'appeals') loadAppeals();
    else loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const doSearch = () => load(keyword.trim() || undefined);

  const openPenalty = (u: any, type: 'mute' | 'ban') => {
    setPenaltyUser(u);
    setPenaltyType(type);
    setPenaltyHours(24);
    setPenaltyDays(7);
    setPenaltyReason('');
  };

  const submitPenalty = async () => {
    if (!penaltyUser) return;
    // 永久封禁判定：必须填写理由，说明用户性质恶劣等判定依据
    if (penaltyType === 'ban' && penaltyDays <= 0 && penaltyReason.trim().length < 5) {
      toast.error('永久封禁必须填写判定理由（至少 5 个字，如：该用户性质恶劣，多次违规）');
      return;
    }
    setBusyId('penalty');
    try {
      let until: string | null = null;
      if (penaltyType === 'ban') {
        until = penaltyDays <= 0 ? null : new Date(Date.now() + penaltyDays * 86400000).toISOString();
      }
      const hours = penaltyType === 'mute' ? penaltyHours : (penaltyDays <= 0 ? 0 : penaltyDays * 24);
      await adminApi.penalizeUser(penaltyUser.id, penaltyType, hours, until, penaltyReason || (penaltyType === 'mute' ? '禁言' : '封禁'));
      toast.success(penaltyType === 'mute' ? '已禁言' : '已封禁');
      setPenaltyUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const revokePenalty = async (u: any) => {
    if (!u.penaltyId) return;
    if (!window.confirm(`确认解除对「${u.nickname}」的${u.penaltyType === 'mute' ? '禁言' : '封禁'}？`)) return;
    setBusyId(u.id);
    try {
      await adminApi.revokePenalty(u.penaltyId);
      toast.success('已解除');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (u: any) => {
    if (window.confirm(`确认${u.isAdmin ? '取消' : '设为'}「${u.nickname}」的管理员权限？`)) {
      try {
        await adminApi.setAdminRole(u.id, !u.isAdmin);
        toast.success('权限已更新');
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  };

  const openHistory = async (u: any) => {
    setHistoryUser(u);
    try {
      setHistory(await adminApi.adminListPenalties(u.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 申诉处理：通过（自动解封）/ 驳回
  const reviewAppeal = async (a: any, status: 'approved' | 'rejected') => {
    const reply = (replyMap[a.id] || '').trim();
    if (status === 'rejected' && !reply) {
      toast.error('驳回时请填写回复说明');
      return;
    }
    setBusyId('appeal-' + a.id);
    try {
      await adminApi.reviewAppeal(a.id, status, reply);
      toast.success(status === 'approved' ? '申诉通过，已自动解除惩罚' : '已驳回申诉');
      loadAppeals();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // 信誉：扣分/加分（量化系统自动触发处罚）
  const submitCredit = async () => {
    if (!creditUser) return;
    if (!creditReason.trim()) { toast.error('请填写原因'); return; }
    setBusyId('credit');
    try {
      const res = await adminApi.deductCredit(creditUser.id, creditDelta, creditReason.trim());
      const actionText = res?.action === 'ban_7d' ? '，量化系统已自动封禁 7 天' : res?.action === 'mute_7d' ? '，量化系统已自动禁言 7 天' : res?.action === 'mute_1d' ? '，量化系统已自动禁言 1 天' : '';
      toast.success(`信誉分已更新为 ${res?.credit}${actionText}`);
      setCreditUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openCreditLogs = async (u: any) => {
    setCreditLogsUser(u);
    try {
      setCreditLogs(await adminApi.adminListCreditLogs(u.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 赏金：发放/去除
  const submitGold = async () => {
    if (!goldUser) return;
    if (!goldReason.trim()) { toast.error('请填写原因'); return; }
    setBusyId('gold');
    try {
      const res = await adminApi.grantBalance(goldUser.id, goldAmount, goldReason.trim());
      toast.success(`赏金已更新为 ¥${res.balance}（变动 ¥${res.delta}，封顶 100）`);
      setGoldUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openGold = async (u: any) => {
    setGoldUser(u);
    setGoldAmount(10);
    setGoldReason('');
    try {
      setGoldLogs(await adminApi.adminBalanceLogs(u.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 晋级审核：通过 / 驳回
  const reviewPromotion = async (r: any, approve: boolean) => {
    const reply = (promoReplyMap[r.id] || '').trim();
    if (!approve && !reply) {
      toast.error('驳回时请填写回复说明');
      return;
    }
    setBusyId('promo-' + r.id);
    try {
      await adminApi.reviewPromotion(r.id, approve, reply);
      toast.success(approve ? `已通过，${r.nickname} 晋升为「${r.toName}」` : '已驳回申请');
      loadPromotions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* 用户 / 申诉 / 晋级 Tab */}
      <div className="bg-white rounded-xl p-1 flex">
        {([
          { key: 'users', label: '用户列表' },
          { key: 'appeals', label: '申诉处理', badge: appeals.filter((a) => a.status === 'pending').length },
          { key: 'promotions', label: '晋级审核', badge: promotions.filter((p) => p.status === 'pending').length },
        ] as { key: 'users' | 'appeals' | 'promotions'; label: string; badge?: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            {t.label}
            {!!t.badge && t.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 晋级审核列表 */}
      {tab === 'promotions' && (
        <div className="space-y-3">
          {loading && promotions.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          )}
          {!loading && promotions.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400">暂无晋级申请</div>
          )}
          {promotions.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{r.nickname || '用户'}</span>
                <span className="text-[10px] text-gray-400">{r.phone}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${
                  r.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100'
                  : r.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100'
                  : 'bg-gray-50 text-gray-500 border-gray-100'
                }`}>
                  {r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已驳回'}
                </span>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-xs text-gray-700 mb-2">
                申请晋级：<b className="text-blue-700">{r.toName}</b>
                <span className="text-gray-400 ml-2">当前声望 {r.points} 点 · 提交于 {formatTime(r.createdAt)}</span>
              </div>
              {r.adminReply && (
                <div className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3.5 py-2.5 mb-2">
                  管理员回复：{r.adminReply}
                </div>
              )}
              {r.status === 'pending' ? (
                <>
                  <input
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-blue-300 mb-2"
                    placeholder="审核回复（驳回必填）"
                    value={promoReplyMap[r.id] || ''}
                    onChange={(e) => setPromoReplyMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewPromotion(r, true)}
                      disabled={busyId === 'promo-' + r.id}
                      className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-xs font-medium disabled:opacity-40"
                    >
                      通过晋级
                    </button>
                    <button
                      onClick={() => reviewPromotion(r, false)}
                      disabled={busyId === 'promo-' + r.id}
                      className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium disabled:opacity-40"
                    >
                      驳回申请
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* 申诉列表 */}
      {tab === 'appeals' && (
        <div className="space-y-3">
          {loading && appeals.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          )}
          {!loading && appeals.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400">暂无申诉</div>
          )}
          {appeals.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-800">{a.userNickname || '用户'}</span>
                <span className="text-[10px] text-gray-400">{a.userPhone}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${
                  a.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100'
                  : a.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100'
                  : 'bg-gray-50 text-gray-500 border-gray-100'
                }`}>
                  {a.status === 'pending' ? '待处理' : a.status === 'approved' ? '已通过' : '已驳回'}
                </span>
              </div>
              <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3.5 py-2.5 mb-2">
                <span className="text-gray-400 mr-1">申诉理由：</span>{a.reason}
              </div>
              {a.adminReply && (
                <div className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3.5 py-2.5 mb-2">
                  管理员回复：{a.adminReply}
                </div>
              )}
              {a.status === 'pending' ? (
                <>
                  <input
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-blue-300 mb-2"
                    placeholder="回复说明（驳回必填）"
                    value={replyMap[a.id] || ''}
                    onChange={(e) => setReplyMap((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewAppeal(a, 'approved')}
                      disabled={busyId === 'appeal-' + a.id}
                      className="flex-1 h-9 rounded-xl bg-green-500 text-white text-xs font-medium disabled:opacity-40"
                    >
                      通过并解除惩罚
                    </button>
                    <button
                      onClick={() => reviewAppeal(a, 'rejected')}
                      disabled={busyId === 'appeal-' + a.id}
                      className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium disabled:opacity-40"
                    >
                      驳回申诉
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* 用户列表 */}
      {tab === 'users' && (
        <>
      {/* 搜索 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-full px-3 h-10 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索昵称 / 手机号"
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <button onClick={doSearch} className="h-10 px-4 rounded-full bg-blue-600 text-white text-xs font-medium">
          搜索
        </button>
      </div>

      {loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {/* 用户列表 */}
      <div className="bg-white rounded-2xl overflow-hidden">
        {!loading && list.length === 0 && (
          <div className="p-12 text-center text-sm text-gray-400">没有匹配的用户</div>
        )}
        <div className="divide-y divide-gray-50">
          {list.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{u.nickname}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">
                      {REALM_LABELS[u.realm as keyof typeof REALM_LABELS] || u.realm}
                    </span>
                    {u.isAdmin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">管理员</span>
                    )}
                    {u.penaltyType === 'mute' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">禁言中</span>
                    )}
                    {u.penaltyType === 'ban' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">已封禁</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {u.phone || '—'} · 声望 {u.points}
                    <span className={`ml-2 ${u.credit >= 60 ? 'text-green-500' : u.credit >= 30 ? 'text-orange-500' : 'text-red-500'}`}>
                      信誉 {u.credit}
                    </span>
                    <span className="ml-2 text-amber-600">赏金 ¥{u.balance ?? 0}</span>
                    · 注册于 {formatTime(u.createdAt)}
                  </div>
                  {u.penaltyType && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      {u.penaltyType === 'mute' ? '禁言' : '封禁'}
                      {u.penaltyUntil ? ` 至 ${formatTime(u.penaltyUntil)}` : '（永久）'}
                      {u.penaltyReason ? ` · ${u.penaltyReason}` : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {u.penaltyType === 'mute' && (
                    <button onClick={() => revokePenalty(u)} disabled={busyId === u.id} className="h-8 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200 disabled:opacity-40 flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5" /> 解禁
                    </button>
                  )}
                  {u.penaltyType === 'ban' && (
                    <button onClick={() => revokePenalty(u)} disabled={busyId === u.id} className="h-8 px-3 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-200 disabled:opacity-40 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" /> 解封
                    </button>
                  )}
                  <button onClick={() => openPenalty(u, 'mute')} className="h-8 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200 flex items-center gap-1">
                    <MicOff className="w-3.5 h-3.5" /> 禁言
                  </button>
                  <button onClick={() => openPenalty(u, 'ban')} className="h-8 px-3 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200 flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" /> 封禁
                  </button>
                  <button onClick={() => openHistory(u)} className="h-8 px-3 rounded-full bg-gray-50 text-gray-500 text-xs font-medium border border-gray-100 flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> 记录
                  </button>
                  <button onClick={() => { setCreditUser(u); setCreditDelta(-10); setCreditReason(''); }} className="h-8 px-3 rounded-full bg-orange-50 text-orange-600 text-xs font-medium border border-orange-200 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> 扣分
                  </button>
                  <button onClick={() => openCreditLogs(u)} className="h-8 px-3 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 信誉
                  </button>
                  <button onClick={() => openGold(u)} className="h-8 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> 赏金
                  </button>
                  <button onClick={() => toggleAdmin(u)} className={`h-8 px-3 rounded-full text-xs font-medium border flex items-center gap-1 ${u.isAdmin ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>
                    {u.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                    {u.isAdmin ? '取消管理员' : '设为管理员'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* 禁言/封禁弹窗 */}
      <Dialog open={!!penaltyUser} onOpenChange={(o) => !o && setPenaltyUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{penaltyType === 'mute' ? '禁言' : '封禁'}「{penaltyUser?.nickname}」</DialogTitle>
            <DialogDescription>
              {penaltyType === 'mute' ? '禁言期间不能提问、回答、评论、发私信' : '封禁期间不能登录使用任何功能'}
            </DialogDescription>
          </DialogHeader>
          {penaltyUser && (
            <div className="space-y-3">
              {penaltyType === 'mute' ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">禁言时长</div>
                  <div className="grid grid-cols-3 gap-2">
                    {MUTE_OPTIONS.map((o) => (
                      <button
                        key={o.hours}
                        onClick={() => setPenaltyHours(o.hours)}
                        className={`h-9 rounded-xl text-xs font-medium border transition-colors ${
                          penaltyHours === o.hours ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">封禁时长</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 7, 30, 365].map((d) => (
                      <button
                        key={d}
                        onClick={() => setPenaltyDays(d)}
                        className={`h-9 rounded-xl text-xs font-medium border transition-colors ${
                          penaltyDays === d ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {d} 天
                      </button>
                    ))}
                    <button
                      onClick={() => setPenaltyDays(0)}
                      className={`h-9 rounded-xl text-xs font-medium border transition-colors ${
                        penaltyDays === 0 ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      永久
                    </button>
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1.5">原因{penaltyType === 'ban' && penaltyDays === 0 ? '（永久封禁必填，需说明判定依据）' : ''}</div>
                <textarea
                  className="w-full h-20 rounded-xl border border-gray-200 text-sm p-3 outline-none focus:border-amber-300"
                  placeholder={penaltyType === 'mute' ? '如：发布广告信息，禁言 7 天' : penaltyDays === 0 ? '必填：该用户性质恶劣，多次违规，需永久封禁' : '如：多次违规，封禁处理'}
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setPenaltyUser(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={submitPenalty}
              disabled={busyId === 'penalty'}
              className={`h-9 px-6 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1 ${penaltyType === 'mute' ? 'bg-amber-500' : 'bg-red-500'}`}
            >
              {busyId === 'penalty' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              确认{penaltyType === 'mute' ? '禁言' : '封禁'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 惩罚历史弹窗 */}
      <Dialog open={!!historyUser} onOpenChange={(o) => !o && setHistoryUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>「{historyUser?.nickname}」惩罚记录</DialogTitle>
            <DialogDescription>全部禁言/封禁历史</DialogDescription>
          </DialogHeader>
          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">暂无记录</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {history.map((h) => (
                <div key={h.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      h.type === 'mute' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {h.type === 'mute' ? '禁言' : '封禁'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      h.status === 'active' ? 'bg-green-50 text-green-600 border-green-100'
                      : h.status === 'expired' ? 'bg-gray-50 text-gray-500 border-gray-100'
                      : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {h.status === 'active' ? '生效中' : h.status === 'expired' ? '已到期' : '已撤销'}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-auto">{formatTime(h.created_at)}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {h.type === 'mute' ? (h.duration_hours === 0 ? '永久禁言' : `禁言 ${h.duration_hours} 小时`) : (h.until ? `封禁至 ${formatTime(h.until)}` : '永久封禁')}
                    {h.reason ? ` · ${h.reason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setHistoryUser(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">关闭</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 扣分/加分弹窗（量化系统） */}
      <Dialog open={!!creditUser} onOpenChange={(o) => !o && setCreditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>信誉分调整「{creditUser?.nickname}」</DialogTitle>
            <DialogDescription>当前信誉 {creditUser?.credit} 分；扣分后按量化规则自动触发禁言/封禁</DialogDescription>
          </DialogHeader>
          {creditUser && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1.5">调整分数</div>
                <div className="grid grid-cols-4 gap-2">
                  {[-5, -10, -20, -50].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCreditDelta(d)}
                      className={`h-9 rounded-xl text-xs font-medium border transition-colors ${creditDelta === d ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={() => setCreditDelta(10)}
                    className={`h-9 rounded-xl text-xs font-medium border transition-colors ${creditDelta === 10 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    +10
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1.5">原因 *</div>
                <textarea
                  className="w-full h-20 rounded-xl border border-gray-200 text-sm p-3 outline-none focus:border-orange-300"
                  placeholder="如：多次发布广告内容，扣 10 分"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-3.5 py-2.5 text-[11px] text-orange-600 leading-relaxed">
                量化规则：&lt;60 自动禁言 1 天 · &lt;30 自动禁言 7 天 · ≤0 自动封禁 7 天
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setCreditUser(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={submitCredit}
              disabled={busyId === 'credit'}
              className="h-9 px-6 bg-orange-500 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
            >
              {busyId === 'credit' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              确认调整
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 赏金管理弹窗 */}
      <Dialog open={!!goldUser} onOpenChange={(o) => !o && setGoldUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>赏金管理「{goldUser?.nickname}」</DialogTitle>
            <DialogDescription>当前赏金 ¥{goldUser?.balance ?? 0} · 发放/去除后余额封顶 100 元</DialogDescription>
          </DialogHeader>
          {goldUser && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1.5">金额（正数发放，负数去除）</div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50].map((v) => (
                    <button key={v} onClick={() => setGoldAmount(v)} className={`h-9 rounded-xl text-xs font-medium border transition-colors ${goldAmount === v ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      +{v}
                    </button>
                  ))}
                  <button onClick={() => setGoldAmount(-(goldUser.balance ?? 0))} className="h-9 rounded-xl text-xs font-medium border border-red-200 bg-red-50 text-red-500">
                    清零
                  </button>
                </div>
                <input
                  type="number"
                  value={goldAmount}
                  onChange={(e) => setGoldAmount(Number(e.target.value) || 0)}
                  className="mt-2 w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-amber-300"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1.5">原因 *</div>
                <textarea
                  className="w-full h-20 rounded-xl border border-gray-200 text-sm p-3 outline-none focus:border-amber-300"
                  placeholder="如：活动奖励 / 违规扣除"
                  value={goldReason}
                  onChange={(e) => setGoldReason(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1.5">余额流水（红色 = 异常变动）</div>
                <div className="max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-2.5 space-y-1.5">
                  {goldLogs.length === 0 && <div className="text-xs text-gray-400 text-center py-2">暂无流水</div>}
                  {goldLogs.map((l) => (
                    <div key={l.id} className={`flex items-center gap-2 text-[11px] ${l.abnormal ? 'bg-red-50 rounded-lg px-2 py-1' : ''}`}>
                      <span className={`font-bold w-9 shrink-0 ${l.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>{l.delta >= 0 ? '+' : ''}{l.delta}</span>
                      <span className="text-gray-600 flex-1 truncate">{l.reason}</span>
                      <span className="text-gray-400 shrink-0">{formatTime(new Date(l.created_at).getTime())}</span>
                      {l.abnormal && <span className="text-red-500 shrink-0">⚠</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setGoldUser(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={submitGold}
              disabled={busyId === 'gold'}
              className="h-9 px-6 bg-amber-500 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
            >
              {busyId === 'gold' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              确认调整
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 信誉记录弹窗 */}
      <Dialog open={!!creditLogsUser} onOpenChange={(o) => !o && setCreditLogsUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>「{creditLogsUser?.nickname}」信誉记录</DialogTitle>
            <DialogDescription>当前信誉 {creditLogsUser?.credit} 分</DialogDescription>
          </DialogHeader>
          {creditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">暂无记录</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {creditLogs.map((l) => (
                <div key={l.id} className="py-2.5 flex items-center gap-3">
                  <span className={`text-sm font-bold w-10 shrink-0 ${l.delta < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {l.delta > 0 ? '+' : ''}{l.delta}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">{l.reason}</div>
                    <div className="text-[10px] text-gray-400">{l.source === 'auto_rule' ? '量化规则' : '管理员'} · {formatTime(l.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setCreditLogsUser(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">关闭</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
