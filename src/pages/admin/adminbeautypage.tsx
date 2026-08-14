import { useState, useEffect, useCallback } from 'react';
import { Crown, Plus, Check, X, RefreshCw, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { adminCreateActivity, adminListCandidates, adminReviewCandidate, listBeautyActivities, getBeautyRankingByPeriod } from '@/lib/features';
import { listCampuses } from '@/lib/commerce';
import { formatTime } from '@/utils/format';
import Avatar from '@/components/Avatar';

type Tab = 'activities' | 'candidates';

export default function AdminBeautyPage() {
  const [tab, setTab] = useState<Tab>('activities');
  const [activities, setActivities] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ title: '', gender: 'female', campus_id: 0, days: 14 });
  // v27：周期榜单
  const [rankAct, setRankAct] = useState<any | null>(null);
  const [rankPeriod, setRankPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [rankList, setRankList] = useState<any[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    if (!rankAct) return;
    setRankLoading(true);
    getBeautyRankingByPeriod(rankAct.id, rankPeriod).then(setRankList).catch(() => setRankList([])).finally(() => setRankLoading(false));
  }, [rankAct, rankPeriod]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, cp] = await Promise.all([listBeautyActivities(), adminListCandidates('pending'), listCampuses()]);
      setActivities(a); setCandidates(c); setCampuses(cp);
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (form.title.trim().length < 2) { toast.error('活动标题至少2个字'); return; }
    try {
      await adminCreateActivity({ title: form.title.trim(), gender: form.gender, campusId: form.campus_id || null, days: form.days });
      toast.success('评选活动已创建并上线');
      setNewOpen(false);
      setForm({ title: '', gender: 'female', campus_id: 0, days: 14 });
      load();
    } catch (e: any) {
      toast.error(e?.message || '创建失败');
    }
  };

  const review = async (id: number, approve: boolean) => {
    try {
      await adminReviewCandidate(id, approve);
      toast.success(approve ? '候选已通过，进入排行榜' : '已拒绝');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const tabs = [
    { key: 'activities' as const, label: '活动管理' },
    { key: 'candidates' as const, label: `候选审核${candidates.length > 0 ? ` (${candidates.length})` : ''}` },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-1 flex border border-gray-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-pink-600 text-white' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">校花校草评选：报名需本校认证修士，免费 1 票 + 付费加票（¥1=10 权重）</p>
        <div className="flex gap-2">
          {tab === 'activities' && (
            <button onClick={() => setNewOpen(true)} className="h-8 px-3.5 rounded-full bg-pink-600 text-white text-xs font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 创建活动
            </button>
          )}
          <button onClick={load} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {tab === 'activities' && (
        activities.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无活动，点击「创建活动」</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {activities.map((a: any) => (
              <div key={a.id} className="p-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-semibold text-gray-800">{a.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {a.status === 'active' ? '进行中' : a.status}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {a.gender === 'female' ? '校花' : '校草'} · {formatTime(new Date(a.start_at).getTime())} ~ {formatTime(new Date(a.end_at).getTime())}
                </div>
                <button
                  onClick={() => { setRankAct(a); setRankPeriod('month'); }}
                  className="mt-2 h-7 px-3 rounded-full bg-pink-50 text-pink-600 text-xs font-medium flex items-center gap-1"
                >
                  <Trophy className="w-3 h-3" /> 查看榜单（月/季/年）
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'candidates' && (
        candidates.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无待审核候选</div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {candidates.map((c: any) => (
              <div key={c.id} className="p-4">
                <div className="flex items-center gap-3">
                  {c.photo ? (
                    <img src={c.photo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <Avatar src={c.profiles?.avatar} alt={c.profiles?.nickname} className="w-12 h-12" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{c.profiles?.nickname || '未知'}</div>
                    <div className="text-[11px] text-gray-400">{c.beauty_activities?.title} · {formatTime(new Date(c.created_at).getTime())}</div>
                    {c.slogan && <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{c.slogan}</div>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => review(c.id, true)} className="flex-1 h-9 rounded-full bg-green-500 text-white text-xs font-medium flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 通过
                  </button>
                  <button onClick={() => review(c.id, false)} className="flex-1 h-9 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center justify-center gap-1">
                    <X className="w-3.5 h-3.5" /> 拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 周期榜单弹窗（v27：月/季/年/全部） */}
      {rankAct && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRankAct(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-pink-500" /> {rankAct.title} · 榜单
            </div>
            <div className="flex gap-2 mt-3 mb-3">
              {([['month', '本月'], ['quarter', '本季'], ['year', '本年'], ['all', '全部']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setRankPeriod(k)}
                  className={`flex-1 h-8 rounded-full text-xs font-medium transition-colors ${rankPeriod === k ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {rankLoading ? (
              <div className="text-center py-10 text-gray-400 text-sm">加载中...</div>
            ) : rankList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">该周期暂无投票</div>
            ) : (
              <div className="space-y-2">
                {rankList.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    {c.photo ? <img src={c.photo} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <Avatar src={c.avatar} alt={c.nickname} className="w-9 h-9" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{c.nickname}</div>
                      <div className="text-[10px] text-gray-400">{c.school || '—'}</div>
                    </div>
                    <span className="text-sm font-bold text-pink-600">{c.votes} 票</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setRankAct(null)} className="mt-4 w-full h-10 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">关闭</button>
          </div>
        </div>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-gray-800 mb-1">创建评选活动</div>
            <div className="text-xs text-gray-400 mb-4">报名需本校认证修士；投票：免费 1 票 + 付费加票</div>
            <div className="space-y-2.5">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="活动标题 *（如：2026 校花评选）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none">
                  <option value="female">校花</option>
                  <option value="male">校草</option>
                </select>
                <select value={form.campus_id} onChange={(e) => setForm({ ...form, campus_id: Number(e.target.value) })} className="h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none">
                  <option value={0}>全部校区</option>
                  {(campuses || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 14 })} placeholder="活动天数（默认 14）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNewOpen(false)} className="flex-1 h-10 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">取消</button>
              <button onClick={submit} className="flex-1 h-10 rounded-full bg-pink-600 text-white text-sm font-bold">创建并上线</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
