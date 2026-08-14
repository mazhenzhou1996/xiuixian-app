import { useState, useEffect, useCallback } from 'react';
import { BadgeCheck, Check, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminapi';
import { formatTime, REALM_LABELS } from '@/utils/format';
import Avatar from '@/components/Avatar';

export default function AdminVerificationsPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reasons, setReasons] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await adminApi.listSchoolVerifications(tab));
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: number, approve: boolean) => {
    try {
      await adminApi.reviewSchoolVerification(id, approve, approve ? '' : (reasons[id] || ''));
      toast.success(approve ? '已认证通过，该修士获得学校认证标识' : '已拒绝');
      setReasons((prev) => ({ ...prev, [id]: '' }));
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const tabs = [
    { key: 'pending' as const, label: `待审核${list.length > 0 && tab === 'pending' ? ` (${list.length})` : ''}` },
    { key: 'approved' as const, label: '已通过' },
    { key: 'rejected' as const, label: '已拒绝' },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="bg-white rounded-xl p-1 flex border border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">修士申请学校认证，审核通过后获得「认证修士」标识（付费咨询固定格仅展示认证修士）</p>
        <button onClick={load} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">
          <BadgeCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {tab === 'pending' ? '暂无待审核的认证申请' : tab === 'approved' ? '暂无已通过认证' : '暂无已拒绝申请'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
          {list.map((v) => (
            <div key={v.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar src={v.avatar} alt={v.nickname} className="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{v.nickname}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                      {REALM_LABELS[v.realm as keyof typeof REALM_LABELS] || v.realm}
                    </span>
                    <span className="text-[10px] text-gray-400">{v.points} 声望</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    申请认证：<b>{v.school}</b>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {formatTime(v.created_at)}
                    {v.reason ? ` · 说明：${v.reason}` : ''}
                    {v.reject_reason ? ` · 拒绝原因：${v.reject_reason}` : ''}
                  </div>
                </div>
              </div>

              {tab === 'pending' && (
                <>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => review(v.id, true)}
                      className="flex-1 h-9 rounded-full bg-green-500 text-white text-xs font-medium hover:bg-green-600 flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> 认证通过
                    </button>
                    <button
                      onClick={() => review(v.id, false)}
                      className="flex-1 h-9 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 flex items-center justify-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> 拒绝
                    </button>
                  </div>
                  <input
                    type="text"
                    value={reasons[v.id] || ''}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [v.id]: e.target.value }))}
                    placeholder="拒绝原因（可选）"
                    className="mt-2 w-full h-8 rounded-lg bg-gray-50 px-3 text-xs outline-none"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
