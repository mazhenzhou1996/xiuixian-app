import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Coins, TrendingUp, TrendingDown, Loader2, Flag, Trophy, CalendarCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const STATUS_LABEL: Record<string, string> = {
  paid: '待回复',
  answered: '已回复',
  rejected: '已拒绝',
  refunded: '已退款',
  completed: '已完成',
};

export default function ConsultationCenterPage() {
  usePageTitle('付费功能');
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [tab, setTab] = useState<'mine' | 'theirs'>('mine');
  const [loading, setLoading] = useState(true);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [reportC, setReportC] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  // 签到
  const [checkin, setCheckin] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const loadCheckin = async () => {
    try {
      const [c, l] = await Promise.all([api.getMyCheckin(), api.getMyBalanceLogs()]);
      setCheckin(c);
      setLogs(l);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadCheckin(); }, []);

  const doCheckin = async () => {
    setChecking(true);
    try {
      const r = await api.checkin();
      toast.success(`签到成功！连签 ${r.streak} 天，获得 ¥${r.reward}`);
      await Promise.all([load(), loadCheckin()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [w, cons] = await Promise.all([api.getMyWallet(), api.listMyConsultations()]);
      setWallet(w);
      setList(cons);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const answer = async (c: any) => {
    if (replyText.trim().length < 2) { toast.error('回复内容太短'); return; }
    setBusyId(c.id);
    try {
      await api.answerConsultation(c.id, replyText.trim());
      toast.success('已回复');
      setReplyId(null);
      setReplyText('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitReport = async () => {
    if (!reportC) return;
    if (reportReason.trim().length < 5) { toast.error('举报原因至少 5 个字'); return; }
    setBusyId(reportC.id);
    try {
      await api.submitReport({
        targetType: 'consultation',
        targetId: String(reportC.id),
        targetUserId: String(reportC.expertId),
        reason: '咨询纠纷：' + reportReason.trim(),
        content: `咨询 #${reportC.id}：${reportC.question.slice(0, 80)}`,
      });
      toast.success('举报已提交，管理员核实后将处理（可退款）');
      setReportC(null);
      setReportReason('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const mine = list.filter((c) => c.isCustomer);
  const theirs = list.filter((c) => !c.isCustomer);

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="付费功能" />

      <div className="px-4 py-3 space-y-3">
        {/* 钱包 */}
        {wallet && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 text-xs text-amber-100 mb-1">
              <Wallet className="w-4 h-4" /> 账户余额
            </div>
            <div className="text-4xl font-bold mb-3">¥{wallet.balance ?? 0}</div>
            <div className="flex gap-6 text-xs">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> 咨询收入 ¥{wallet.income ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> 咨询支出 ¥{wallet.expense ?? 0}
              </span>
              <span>发起 {wallet.consult_count ?? 0} 次 · 回复 {wallet.answered_count ?? 0} 次</span>
            </div>
            <button
              onClick={() => toast.info('在线支付即将开放，当前请联系管理员在后台充值（见「我的 → 联系客服」）')}
              className="mt-3 w-full h-10 rounded-xl bg-white text-amber-600 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
            >
              <Coins className="w-4 h-4" /> 账户充值
            </button>
          </div>
        )}

        {/* 收支详情（余额流水） */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> 收支详情
            </div>
            <span className="text-[11px] text-gray-400">账户余额变动记录</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">暂无收支记录</div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-3 max-h-64 overflow-y-auto space-y-2">
              {logs.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`font-bold w-12 shrink-0 ${l.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {l.delta >= 0 ? '+' : ''}{l.delta}
                  </span>
                  <span className="text-gray-600 flex-1 truncate">{l.reason}</span>
                  <span className="text-gray-400 shrink-0">{formatTime(new Date(l.created_at).getTime())}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 签到卡片 */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-green-600" /> 每日签到
            </div>
            <span className="text-[11px] text-gray-400">已累计签到 ¥{checkin?.total_reward ?? 0}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 rounded-xl bg-green-50 border border-green-100 px-3.5 py-2.5">
              <div className="text-xl font-bold text-green-600">连签 {checkin?.streak ?? 0} 天</div>
              <div className="text-[10px] text-gray-400 mt-0.5">连签福利：3 天 ¥2 / 7 天 ¥3 / 14 天 ¥5 / 30 天 ¥10</div>
            </div>
            <button
              onClick={doCheckin}
              disabled={checking || checkin?.checked_today}
              className={`h-12 px-5 rounded-xl text-sm font-bold shrink-0 disabled:opacity-50 ${checkin?.checked_today ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md shadow-green-100'}`}
            >
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : checkin?.checked_today ? '今日已签' : '签到领赏金'}
            </button>
          </div>
          <button onClick={() => navigate('/my/earnings')} className="text-[11px] text-gray-400">
            我的咨询定价 / 收益 →
          </button>
          <div className="text-[10px] text-gray-400 mt-2">赏金账户封顶 ¥100（签到与发放受限，咨询收入不受限）</div>
        </div>

        {/* 订单列表 */}
        <div className="bg-white rounded-xl p-1 flex">
          {([
            { key: 'mine', label: `我发起的（${mine.length}）` },
            { key: 'theirs', label: `我收到的（${theirs.length}）` },
          ] as { key: 'mine' | 'theirs'; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-amber-500 text-white' : 'text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : (tab === 'mine' ? mine : theirs).length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-400">
            {tab === 'mine' ? '还没有发起过咨询' : '还没有收到咨询'}
          </div>
        ) : (
          <div className="space-y-3">
            {(tab === 'mine' ? mine : theirs).map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">
                    {c.isCustomer ? `咨询 ${c.expertName}` : `${c.customerName} 咨询我`}
                  </span>
                  <span className="text-xs font-bold text-amber-600">¥{c.price}</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${
                    c.status === 'answered' ? 'bg-green-50 text-green-600 border-green-100'
                    : c.status === 'refunded' ? 'bg-gray-50 text-gray-500 border-gray-100'
                    : c.status === 'paid' ? 'bg-amber-50 text-amber-600 border-amber-100'
                    : 'bg-red-50 text-red-500 border-red-100'
                  }`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-xs text-gray-700 mb-2">
                  <span className="text-gray-400">问题：</span>{c.question}
                </div>
                {c.answer && (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-3.5 py-2.5 text-xs text-gray-700 mb-2 whitespace-pre-line">
                    <span className="text-green-600 font-medium">回复：</span>{c.answer}
                  </div>
                )}
                <div className="text-[10px] text-gray-400 mb-2.5">
                  {formatTime(new Date(c.createdAt).getTime())}
                  {c.answeredAt ? ` · 回复于 ${formatTime(new Date(c.answeredAt).getTime())}` : ''}
                </div>

                {/* 答主回复 */}
                {!c.isCustomer && c.status === 'paid' && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-20 rounded-xl border border-gray-200 p-2.5 text-xs outline-none focus:border-amber-300"
                      placeholder="输入回复内容..."
                      value={replyId === c.id ? replyText : ''}
                      onChange={(e) => { setReplyId(c.id); setReplyText(e.target.value); }}
                    />
                    <button
                      onClick={() => answer(c)}
                      disabled={busyId === c.id}
                      className="w-full h-9 rounded-xl bg-amber-500 text-white text-xs font-medium disabled:opacity-40"
                    >
                      {busyId === c.id ? '提交中...' : '回复并完成咨询'}
                    </button>
                  </div>
                )}

                {/* 客户操作:对效果不满意举报 */}
                {c.isCustomer && c.status === 'answered' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setReportC(c); setReportReason(''); }}
                      className="h-8 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium border border-red-100 flex items-center gap-1"
                    >
                      <Flag className="w-3.5 h-3.5" /> 对回复不满意，举报
                    </button>
                  </div>
                )}

                {/* 客户操作:投诉通过(已退款)后可释放到悬赏榜 */}
                {c.isCustomer && c.status === 'refunded' && (
                  <button
                    onClick={async () => {
                      try {
                        const b = await api.createBountyFromConsultation(c.id);
                        toast.success('已释放到悬赏榜，可追加悬赏金');
                        navigate(`/bounty/${b.id}`);
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                    className="h-8 px-3 rounded-full bg-violet-600 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Trophy className="w-3.5 h-3.5" /> 释放到悬赏榜
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 咨询举报弹窗 */}
      <Dialog open={!!reportC} onOpenChange={(o) => !o && setReportC(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>举报咨询 #{reportC?.id}</DialogTitle>
            <DialogDescription>对咨询效果不满意？提交举报后管理员将核实，确认后可全额退款</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-24 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-red-300"
            placeholder="请说明不满意的原因（至少 5 个字）..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
          />
          <DialogFooter>
            <button onClick={() => setReportC(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={submitReport}
              disabled={busyId === reportC?.id}
              className="h-9 px-6 bg-red-500 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
            >
              {busyId === reportC?.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 提交举报
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
