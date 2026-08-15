import { useState, useEffect } from 'react';
import { Flag, EyeOff, Trash2, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';

const STATUS_FILTERS = [
  { key: 'pending', label: '待处理' },
  { key: 'all', label: '全部' },
  { key: 'resolved', label: '已处理' },
  { key: 'rejected', label: '已驳回' },
];

const TYPE_FILTERS = [
  { key: 'all', label: '全部类型' },
  { key: 'question', label: '问题' },
  { key: 'answer', label: '回答' },
  { key: 'comment', label: '评论' },
  { key: 'confession', label: '表白' },
  { key: 'message', label: '私信' },
  { key: 'user', label: '用户' },
];

const TYPE_LABEL: Record<string, string> = {
  question: '问题', answer: '回答', comment: '评论', confession: '表白', user: '用户', message: '私信',
};

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let rows = await adminApi.listReports(statusFilter === 'all' ? undefined : statusFilter);
      if (typeFilter !== 'all') rows = rows.filter((r: any) => r.targetType === typeFilter);
      setList(rows);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, typeFilter]);

  const handleHide = async (r: any) => {
    if (!['question', 'answer', 'comment', 'confession'].includes(r.targetType)) {
      toast.info('该类型不支持直接下架');
      return;
    }
    setBusyId(r.id);
    try {
      if (r.targetType === 'confession') {
        await adminApi.adminDeleteConfession(Number(r.targetId));
      } else {
        await adminApi.setContentStatus(r.targetType as any, r.targetId, 'hidden');
      }
      await adminApi.setReportStatus(r.id, 'resolved');
      // 量化系统：确认违规下架扣 5 分
      if (r.targetUserId && r.targetType !== 'confession') {
        try {
          const res = await adminApi.deductCredit(r.targetUserId, -5, `内容被确认违规下架（${r.targetType} #${r.targetId}）`);
          if (res?.action && res.action !== 'none') {
            const t = res.action === 'ban_7d' ? '自动封禁 7 天' : res.action === 'mute_7d' ? '自动禁言 7 天' : '自动禁言 1 天';
            toast.info(`量化系统：该作者信誉分 ${res.credit}，${t}`);
          }
        } catch { /* ignore */ }
      }
      toast.success('内容已下架并结案');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (r: any) => {
    if (!['question', 'answer', 'comment', 'confession'].includes(r.targetType)) {
      toast.info('私信/用户举报请人工处理');
      return;
    }
    if (!window.confirm(`确认删除该${TYPE_LABEL[r.targetType]}（ID ${r.targetId}）？将不可恢复。`)) return;
    setBusyId(r.id);
    try {
      if (r.targetType === 'confession') {
        await adminApi.adminDeleteConfession(Number(r.targetId));
      } else {
        await adminApi.adminDeleteContent(r.targetType as any, r.targetId);
      }
      await adminApi.setReportStatus(r.id, 'resolved');
      // 量化系统：内容被删除扣 10 分
      if (r.targetUserId && r.targetType !== 'confession') {
        try {
          const res = await adminApi.deductCredit(r.targetUserId, -10, `内容被管理员删除（${r.targetType} #${r.targetId}）`);
          if (res?.action && res.action !== 'none') {
            const t = res.action === 'ban_7d' ? '自动封禁 7 天' : res.action === 'mute_7d' ? '自动禁言 7 天' : '自动禁言 1 天';
            toast.info(`量化系统：该作者信誉分 ${res.credit}，${t}`);
          }
        } catch { /* ignore */ }
      }
      toast.success('内容已删除并结案');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (r: any, status: string) => {
    setBusyId(r.id);
    try {
      await adminApi.setReportStatus(r.id, status);
      toast.success(status === 'rejected' ? '已驳回' : '已标记处理中');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* 状态筛选 */}
      <div className="bg-white rounded-xl p-1 flex overflow-x-auto">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`flex-1 shrink-0 py-2 px-3 text-xs font-medium rounded-lg transition-colors ${statusFilter === s.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 类型筛选 */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${typeFilter === t.key ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <Flag className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">暂无举报</p>
        </div>
      )}

      {/* 举报卡片列表 */}
      <div className="space-y-3">
        {list.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                {TYPE_LABEL[r.targetType] || r.targetType}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                r.status === 'pending' ? 'bg-red-50 text-red-500 border-red-100'
                : r.status === 'resolved' ? 'bg-green-50 text-green-600 border-green-100'
                : r.status === 'processing' ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-gray-50 text-gray-500 border-gray-100'
              }`}>
                {r.status === 'pending' ? '待处理' : r.status === 'resolved' ? '已处理' : r.status === 'processing' ? '处理中' : '已驳回'}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">举报 #{r.id}</span>
            </div>

            {/* 举报描述 */}
            <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 mb-2">
              {r.reason && <div className="text-xs text-red-500 font-medium mb-1">原因：{r.reason}</div>}
              <div className="text-xs text-gray-700 whitespace-pre-line line-clamp-3">{r.content || '（无内容描述）'}</div>
            </div>

            {/* 元信息 */}
            <div className="text-[11px] text-gray-400 mb-3">
              举报人：{r.reporterName || '匿名'} · {formatTime(r.createdAt)}
              <span className="mx-1.5">|</span>
              目标 ID：{r.targetId}
              {r.targetUserId ? <span> · 作者 {r.targetUserId.slice(0, 8)}</span> : ''}
            </div>

            {/* 操作区 */}
            {r.status === 'pending' ? (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleDelete(r)}
                  disabled={busyId === r.id}
                  className="flex-1 min-w-[110px] h-9 rounded-xl bg-red-500 text-white text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  删除并结案
                </button>
                <button
                  onClick={() => handleHide(r)}
                  disabled={busyId === r.id}
                  className="flex-1 min-w-[110px] h-9 rounded-xl bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200 disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <EyeOff className="w-3.5 h-3.5" /> 下架并结案
                </button>
                <button
                  onClick={() => handleStatus(r, 'processing')}
                  disabled={busyId === r.id}
                  className="flex-1 min-w-[90px] h-9 rounded-xl bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200 disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" /> 处理中
                </button>
                <button
                  onClick={() => handleStatus(r, 'rejected')}
                  disabled={busyId === r.id}
                  className="flex-1 min-w-[90px] h-9 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> 驳回
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 已处理
                </span>
                <button
                  onClick={() => handleStatus(r, 'pending')}
                  disabled={busyId === r.id}
                  className="h-8 px-4 rounded-full bg-gray-100 text-gray-500 text-xs font-medium disabled:opacity-40"
                >
                  重新打开
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
