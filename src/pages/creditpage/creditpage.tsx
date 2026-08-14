import { useState, useEffect } from 'react';
import { Shield, Minus, Plus, Loader2, Info } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

const CREDIT_RULES = [
  { desc: '内容被管理员删除', points: -10 },
  { desc: '内容被确认违规下架', points: -5 },
  { desc: '被举报核实违规', points: -5 },
];

const AUTO_RULES = [
  { cond: '信用分 < 60', action: '自动禁言 1 天' },
  { cond: '信用分 < 30', action: '自动禁言 7 天' },
  { cond: '信用分 ≤ 0', action: '自动封禁 7 天' },
];

export default function CreditPage() {
  usePageTitle('信誉系统');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.getMyCredit());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const credit = data?.credit ?? 100;
  const logs: any[] = data?.logs || [];

  const creditColor =
    credit >= 100 ? 'text-green-600'
    : credit >= 60 ? 'text-yellow-500'
    : credit >= 30 ? 'text-orange-500'
    : 'text-red-500';

  const creditBg =
    credit >= 100 ? 'bg-green-50 border-green-100'
    : credit >= 60 ? 'bg-yellow-50 border-yellow-100'
    : credit >= 30 ? 'bg-orange-50 border-orange-100'
    : 'bg-red-50 border-red-100';

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="信誉系统" />

      <div className="px-4 py-3 space-y-3">
        {/* 信用分卡片 */}
        <div className={`rounded-2xl border ${creditBg} p-5 text-center`}>
          <div className="text-xs text-gray-500 mb-1">当前信誉分</div>
          <div className={`text-5xl font-bold ${creditColor}`}>{loading ? '—' : credit}</div>
          <div className="text-[11px] text-gray-400 mt-2">
            {credit >= 100 ? '信誉良好，请继续保持' : credit >= 60 ? '信誉一般，注意规范发言' : credit >= 30 ? '信誉较差，违规将受更严处理' : '信誉极差，账号处于风险状态'}
          </div>
        </div>

        {/* 扣分记录 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">扣分记录</span>
            <span className="ml-auto text-[11px] text-gray-400">{logs.length} 条</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">暂无记录，信誉良好</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((l, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${l.delta < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    {l.delta < 0 ? <Minus className="w-4 h-4 text-red-500" /> : <Plus className="w-4 h-4 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700">{l.reason}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {l.source === 'auto_rule' ? '量化规则自动' : '管理员'} · {formatTime(new Date(l.created_at).getTime())}
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${l.delta < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {l.delta > 0 ? '+' : ''}{l.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 规则说明 */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">量化规则说明</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1.5">
            <div className="text-gray-500 font-medium mb-0.5">扣分项：</div>
            {CREDIT_RULES.map((r) => (
              <div key={r.desc} className="flex justify-between">
                <span>{r.desc}</span>
                <span className="text-red-500 font-medium">{r.points}</span>
              </div>
            ))}
            <div className="text-gray-500 font-medium mt-3 mb-0.5">自动处理：</div>
            {AUTO_RULES.map((r) => (
              <div key={r.cond} className="flex justify-between">
                <span>{r.cond}</span>
                <span className="text-orange-500 font-medium">{r.action}</span>
              </div>
            ))}
            <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-50">
              信誉分随违规自动扣减并触发对应处罚，分值可在管理员后台调整
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
