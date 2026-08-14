import { useState, useEffect } from 'react';
import { Loader2, Coins, RotateCcw } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
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

export default function AdminConsultationsPage() {
  const [filter, setFilter] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (f: string) => {
    setLoading(true);
    try {
      setList(await adminApi.adminListConsultations(f || undefined));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const doRefund = async () => {
    if (!refundTarget) return;
    if (refundReason.trim().length < 3) { toast.error('请填写退款原因'); return; }
    setBusy(true);
    try {
      await adminApi.refundConsultation(refundTarget.id, refundReason.trim());
      toast.success('已退款（答主扣回，客户退回）');
      setRefundTarget(null);
      setRefundReason('');
      load(filter);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 状态筛选 */}
      <div className="bg-white rounded-xl p-1 flex overflow-x-auto">
        {[
          { key: '', label: '全部' },
          { key: 'paid', label: '待回复' },
          { key: 'answered', label: '已回复' },
          { key: 'refunded', label: '已退款' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`flex-1 shrink-0 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${filter === s.key ? 'bg-amber-500 text-white' : 'text-gray-500'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 leading-relaxed">
        付费咨询全量订单：处理用户对咨询效果的举报（举报在「举报审核」中，targetType=consultation），核实后在此退款（答主扣回、客户退回）。纠纷金额可在各用户「信誉/余额」中核对。
      </div>

      {loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400">暂无咨询订单</div>
      )}

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">
                {c.customer_name} → {c.expert_name}
              </span>
              <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                <Coins className="w-3.5 h-3.5" /> ¥{c.price}
              </span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${
                c.status === 'answered' ? 'bg-green-50 text-green-600 border-green-100'
                : c.status === 'refunded' ? 'bg-gray-50 text-gray-500 border-gray-100'
                : 'bg-amber-50 text-amber-600 border-amber-100'
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
            <div className="text-[10px] text-gray-400 mb-3">
              #{c.id} · {formatTime(new Date(c.created_at).getTime())}
              {c.answered_at ? ` · 回复于 ${formatTime(new Date(c.answered_at).getTime())}` : ''}
            </div>
            {c.status !== 'refunded' && (
              <button
                onClick={() => { setRefundTarget(c); setRefundReason(''); }}
                className="h-8 px-4 rounded-full bg-red-50 text-red-500 text-xs font-medium border border-red-100 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 退款
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 退款弹窗 */}
      <Dialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退款咨询 #{refundTarget?.id}</DialogTitle>
            <DialogDescription>退款后：答主账户扣回 ¥{refundTarget?.price}，客户账户退回 ¥{refundTarget?.price}</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-24 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-red-300"
            placeholder="退款原因（将记录在订单中）..."
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <DialogFooter>
            <button onClick={() => setRefundTarget(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={doRefund}
              disabled={busy}
              className="h-9 px-6 bg-red-500 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 确认退款
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
