import { useState, useEffect } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';

const ACTION_LABEL: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  rollback: '回滚',
};

const TABLE_LABEL: Record<string, string> = {
  universities: '高校',
  topic_services: '九宫格服务',
  topic_configs: '专题配置',
};

export default function AdminChangesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setList(await adminApi.listChangeLogs());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRollback = async (c: any) => {
    if (c.action === 'rollback') {
      toast.info('回滚记录本身不可再回滚');
      return;
    }
    if (!window.confirm(`确认回滚「${TABLE_LABEL[c.tableName] || c.tableName} #${c.recordId}」的${ACTION_LABEL[c.action] || c.action}操作？将恢复为变更前的状态。`)) return;
    setBusyId(c.id);
    try {
      const msg = await adminApi.rollback(c.id);
      toast.success(msg);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
        所有后台修改（高校 / 九宫格 / 专题配置）都会记录在这里。改错了点「回滚」即可恢复变更前的状态；删除的记录也会保留变更记录，可恢复。
      </div>

      {loading && list.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <History className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">暂无变更记录</p>
        </div>
      )}

      <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
        {list.map((c) => (
          <div key={c.id} className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                c.action === 'rollback' ? 'bg-violet-50 text-violet-600 border-violet-100'
                : c.action === 'delete' ? 'bg-red-50 text-red-500 border-red-100'
                : c.action === 'create' ? 'bg-green-50 text-green-600 border-green-100'
                : 'bg-blue-50 text-blue-600 border-blue-100'
              }`}>
                {ACTION_LABEL[c.action] || c.action}
              </span>
              <span className="text-xs text-gray-700 font-medium">
                {TABLE_LABEL[c.tableName] || c.tableName} #{c.recordId}
              </span>
              <span className="text-[11px] text-gray-400 ml-auto">
                {c.adminName || '管理员'} · {formatTime(c.createdAt)}
              </span>
            </div>
            {c.note && <div className="text-[11px] text-gray-500 mb-1">{c.note}</div>}
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[10px] text-gray-400 font-mono truncate">
                {c.before ? `前: ${JSON.stringify(c.before).slice(0, 120)}` : '前: (无)'}
                {c.after ? `  → 后: ${JSON.stringify(c.after).slice(0, 120)}` : ''}
              </div>
              {c.action !== 'rollback' && (
                <button
                  onClick={() => handleRollback(c)}
                  disabled={busyId === c.id}
                  className="shrink-0 h-7 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200 disabled:opacity-40 flex items-center gap-1"
                >
                  {busyId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  回滚
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
