import { useState, useEffect, useCallback } from 'react';
import { PackageSearch, Trophy, RefreshCw, X, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';

type Tab = 'lost' | 'bounty';

/**
 * v27 后台：失物/寻物 + 悬赏/跑腿管理
 */
export default function AdminCommunityPage() {
  const [tab, setTab] = useState<Tab>('lost');
  const [lost, setLost] = useState<any[]>([]);
  const [bounties, setBounties] = useState<any[]>([]);
  const [lostFilter, setLostFilter] = useState('all');
  const [bountyFilter, setBountyFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'lost') {
        setLost(await adminApi.adminListLost(lostFilter));
      } else {
        setBounties(await adminApi.adminListBounties(bountyFilter));
      }
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lostFilter, bountyFilter]);

  useEffect(() => { load(); }, [load]);

  const closeLost = async (id: number) => {
    if (!window.confirm('确认下架该失物信息？')) return;
    try {
      await adminApi.adminCloseLost(id);
      toast.success('已下架');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const closeBounty = async (id: number) => {
    if (!window.confirm('确认关闭该悬赏？')) return;
    try {
      await adminApi.adminCloseBounty(id);
      toast.success('已关闭');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const lostTabs = [['all', '全部'], ['lost', '寻物'], ['found', '拾到'], ['resolved', '已解决'], ['closed', '已下架']];
  const bountyTabs = [['all', '全部'], ['question', '问答'], ['item', '物品'], ['service', '跑腿服务']];

  return (
    <div className="space-y-3">
      {/* 模块切换 */}
      <div className="bg-white rounded-xl p-1 flex border border-gray-100">
        <button
          onClick={() => setTab('lost')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${tab === 'lost' ? 'bg-teal-600 text-white' : 'text-gray-500'}`}
        >
          <PackageSearch className="w-3.5 h-3.5" /> 失物/寻物
        </button>
        <button
          onClick={() => setTab('bounty')}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${tab === 'bounty' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}
        >
          <Trophy className="w-3.5 h-3.5" /> 悬赏/跑腿
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(tab === 'lost' ? lostTabs : bountyTabs).map(([k, label]) => (
          <button
            key={k}
            onClick={() => (tab === 'lost' ? setLostFilter(k) : setBountyFilter(k))}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${(tab === 'lost' ? lostFilter : bountyFilter) === k ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {label}
          </button>
        ))}
        <button onClick={load} className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 ml-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {tab === 'lost' && (
        loading ? <div className="text-center py-16 text-gray-400 text-sm">加载中...</div> :
        lost.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无数据</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {lost.map((l: any) => (
              <div key={l.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${l.kind === 'lost' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {l.kind === 'lost' ? '寻物' : '拾到'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {l.status === 'active' ? (l.pinned ? '置顶中' : '进行中') : l.status}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{formatTime(new Date(l.created_at).getTime())}</span>
                </div>
                <div className="text-sm font-medium text-gray-800 mt-1.5">{l.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {l.category}{l.location ? ` · ${l.location}` : ''} · 发布者：{l.user_nickname || '未知'}
                </div>
                {l.status === 'active' && (
                  <button onClick={() => closeLost(l.id)} className="mt-2 h-7 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> 下架
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'bounty' && (
        loading ? <div className="text-center py-16 text-gray-400 text-sm">加载中...</div> :
        bounties.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无数据</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {bounties.map((b: any) => (
              <div key={b.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    b.bounty_type === 'question' ? 'bg-blue-50 text-blue-600'
                    : b.bounty_type === 'item' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {b.bounty_type === 'question' ? '问答悬赏' : b.bounty_type === 'item' ? '物品悬赏' : '跑腿服务'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.status === 'open' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {b.status === 'open' ? '进行中' : b.status}
                  </span>
                  <span className="text-sm font-bold text-amber-600 ml-auto flex items-center gap-0.5">
                    <Trophy className="w-3 h-3" /> ¥{b.total_amount}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-800 mt-1.5 line-clamp-1">{b.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {b.bounty_type === 'service' && b.campus ? `${b.campus} · ` : ''}{b.answer_count || 0} 条回复 · 发布者：{b.owner_name || '未知'}
                </div>
                {b.status === 'open' && (
                  <button onClick={() => closeBounty(b.id)} className="mt-2 h-7 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1">
                    <X className="w-3 h-3" /> 关闭
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
