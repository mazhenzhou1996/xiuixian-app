import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Coins, MessageSquare, Loader2, ThumbsUp, CheckCircle2, Plus, Send, EyeOff, Trash2, BadgeCheck, School, Globe, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { api } from '@/lib/api';
import { listCampuses } from '@/lib/commerce';
import { listBountiesV2, PLATFORM_FEE_RATE } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime, REALM_LABELS } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function BountyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  usePageTitle(id ? '悬赏详情' : '悬赏榜');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  // 列表
  const [list, setList] = useState<any[]>([]);
  // v25：类型 tab（问答/物品/服务）
  const [bountyType, setBountyType] = useState('all');
  // v30：范围切换（全网/本校）+ 本校校区
  const [scope, setScope] = useState<'all' | 'school'>('all');
  const [myCampusId, setMyCampusId] = useState<number | null>(null);
  const [campusLoading, setCampusLoading] = useState(false);
  // v18：发布者学校认证标识映射
  const [verifiedMap, setVerifiedMap] = useState<Record<string, { verified: boolean; school: string }>>({});
  // 详情
  const [bounty, setBounty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isOwner = !!currentUser && bounty?.ownerId === currentUser.id;
  const [answerText, setAnswerText] = useState('');
  const [addAmount, setAddAmount] = useState(10);
  const [busy, setBusy] = useState(false);

  // v30：当前用户所选学校 → 校区映射（本校悬赏用）
  useEffect(() => {
    if (id) return;
    const selected = store.getSelectedSchool();
    if (!selected) { setMyCampusId(null); return; }
    setCampusLoading(true);
    listCampuses().then((list: any[]) => {
      const campus = (list || []).find((x: any) => Number(x.university_id) === Number(selected.id));
      setMyCampusId(campus ? campus.id : null);
    }).catch(() => setMyCampusId(null)).finally(() => setCampusLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope === 'school' ? 'school' : 'all', store]);

  useEffect(() => {
    (async () => {
      if (id) {
        try { setBounty(await api.getBounty(Number(id))); } catch (e: any) { toast.error(e.message); }
      } else {
        try {
          let rows;
          if (bountyType === 'all' && scope !== 'school') {
            rows = await api.listBounties();
          } else {
            // 物品/服务/待办/提问类型走 v2 RPC（含 campus_id，本校过滤必需）
            rows = await listBountiesV2(bountyType === 'all' ? 'all' : bountyType, 60);
          }
          // v30：本校悬赏 → 按当前学校对应校区过滤
          if (scope === 'school' && myCampusId) {
            rows = (rows || []).filter((b: any) => Number(b.campus_id) === Number(myCampusId));
          }
          setList(rows);
          // v18：加载发布者认证标识（公开视图）
          const ownerIds = [...new Set((rows || []).map((b: any) => b.ownerId || b.owner_id).filter(Boolean))];
          if (ownerIds.length > 0) {
            const { data: vdata } = await supabase
              .from('profiles_public')
              .select('id, school_verified, school')
              .in('id', ownerIds);
            const map: Record<string, { verified: boolean; school: string }> = {};
            (vdata || []).forEach((p: any) => { map[String(p.id)] = { verified: !!p.school_verified, school: p.school || '' }; });
            setVerifiedMap(map);
          }
        } catch (e: any) { toast.error(e.message); }
      }
      setLoading(false);
    })();
  }, [id]);

  // ---- 操作 ----
  const submitAnswer = async () => {
    if (!id) return;
    if (answerText.trim().length < 5) { toast.error('回复至少 5 个字'); return; }
    setBusy(true);
    try {
      await api.answerBounty(Number(id), answerText.trim());
      toast.success('已接取并回复，等待悬赏人认可');
      setAnswerText('');
      setBounty(await api.getBounty(Number(id)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addMoney = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api.addBountyMoney(Number(id), addAmount);
      toast.success(`已追加 ¥${addAmount}`);
      setBounty(await api.getBounty(Number(id)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const likeAnswer = async (aid: number) => {
    try {
      await api.likeBountyAnswer(aid);
      setBounty(await api.getBounty(Number(id)));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const acceptAnswer = async (aid: number) => {
    if (!window.confirm('确认认可该答案为最佳？将按规则分红并自动生成推荐问题。')) return;
    setBusy(true);
    try {
      const r = await api.acceptBountyAnswer(Number(id), aid);
      toast.success('已认可答案：最佳答案获 70%，其余回复按点赞分红');
      if (r?.question_id) {
        toast.success(`已自动生成推荐问题 #${r.question_id}`);
        navigate(`/question/${r.question_id}`);
        return;
      }
      setBounty(await api.getBounty(Number(id)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ============ 列表 ============
  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 pb-4">
        <PageHeader title="悬赏榜" />
        <div className="px-4 py-3 space-y-3">
          {/* v30：范围切换 全网/本校 */}
          {!id && (
            <div className="bg-white rounded-2xl p-1 flex shadow-sm">
              <button
                onClick={() => setScope('all')}
                className={`flex-1 h-9 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${scope === 'all' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500'}`}
              >
                <Globe className="w-4 h-4" /> 全网悬赏
              </button>
              <button
                onClick={() => {
                  const selected = store.getSelectedSchool();
                  if (!selected) {
                    toast.info('请先选择学校');
                    navigate('/topic/university');
                    return;
                  }
                  setScope('school');
                }}
                className={`flex-1 h-9 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${scope === 'school' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}
              >
                <School className="w-4 h-4" />
                {scope === 'school' && store.getSelectedSchool()
                  ? `本校悬赏（${String(store.getSelectedSchool().name).slice(0, 6)}）`
                  : '本校悬赏'}
              </button>
            </div>
          )}
          {scope === 'school' && campusLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 正在定位本校校区...
            </div>
          )}
          {scope === 'school' && !campusLoading && !myCampusId && !id && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-xs text-amber-700">
              暂未匹配到「{store.getSelectedSchool()?.name || '当前学校'}」的校区，本校悬赏暂不可用，可先浏览全网悬赏。
            </div>
          )}
          {/* v30：分类 tab（寻物/提问/代办跑腿） */}
          {!id && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[['all', '全部'], ['item', '寻物'], ['question', '提问'], ['todo', '代办跑腿'], ['service', '其他']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setBountyType(k)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${bountyType === k ? 'bg-red-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl p-4 text-white">
            <div className="text-base font-bold flex items-center gap-1.5">
              <Trophy className="w-5 h-5" /> 悬赏榜
            </div>
            <div className="text-xs text-rose-100 mt-1">
              悬赏含 {Math.round(PLATFORM_FEE_RATE * 100)}% 平台服务费，认可后最佳答案获 70% · 其余 30% 按点赞分红
            </div>
          </div>
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          ) : list.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400">暂无悬赏，快来发布第一个悬赏吧</div>
          ) : (
            list.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/bounty/${b.id}`)}
                className="bg-white rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800 flex-1 line-clamp-1">{b.title}</span>
                  <span className="text-sm font-bold text-amber-600 flex items-center gap-0.5 shrink-0">
                    <Coins className="w-3.5 h-3.5" /> ¥{b.totalAmount}
                  </span>
                </div>
                <div className="text-xs text-gray-500 line-clamp-2 mb-2.5">{b.content}</div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {b.answerCount} 条回复</span>
                  <span className="flex items-center gap-1">
                    {b.ownerName} 悬赏
                    {verifiedMap[String(b.ownerId)]?.verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
                        <BadgeCheck className="w-3 h-3" />
                        {verifiedMap[String(b.ownerId)]?.school || '已认证'}
                      </span>
                    )}
                  </span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full border ${b.bounty_type === 'item' ? 'bg-amber-50 text-amber-600 border-amber-100' : b.bounty_type === 'question' ? 'bg-blue-50 text-blue-600 border-blue-100' : b.bounty_type === 'todo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {b.bounty_type === 'item' ? '寻物' : b.bounty_type === 'question' ? '提问' : b.bounty_type === 'todo' ? '代办跑腿' : b.bounty_type === 'service' ? '其他' : '悬赏'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ============ 详情 ============
  if (!bounty) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="悬赏详情" />
        <div className="text-center py-20 text-gray-400 text-sm">{loading ? '加载中...' : '悬赏不存在'}</div>
      </div>
    );
  }

  const accepted = bounty.answers.find((a: any) => a.id === bounty.acceptedAnswerId);

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="悬赏详情" />

      <div className="px-4 py-3 space-y-3">
        {/* 悬赏信息 */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-semibold">{bounty.ownerName} 的悬赏</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/20">
              {bounty.status === 'open' ? '进行中' : '已结束'}
            </span>
          </div>
          <div className="text-lg font-bold mb-1">{bounty.title}</div>
          <div className="text-xs text-rose-100 whitespace-pre-line">{bounty.content}</div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-xl font-bold">¥{bounty.totalAmount}</span>
            <span className="text-[11px] text-rose-100">悬赏总额（含 {Math.round(PLATFORM_FEE_RATE * 100)}% 平台服务费）· 认可后最佳答案 70% · 其余 30% 分红</span>
          </div>
          <div className="text-[11px] text-rose-100/90">
            平台服务费 ¥{Math.round(bounty.totalAmount * PLATFORM_FEE_RATE * 100) / 100} · 赏金池 ¥{Math.round(bounty.totalAmount * (1 - PLATFORM_FEE_RATE) * 100) / 100}
          </div>
          {bounty.status === 'open' && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={addAmount}
                onChange={(e) => setAddAmount(Number(e.target.value) || 0)}
                className="w-20 h-8 rounded-lg bg-white/20 text-white text-sm px-2 outline-none"
              />
              <button
                onClick={addMoney}
                disabled={busy}
                className="h-8 px-3 rounded-full bg-white text-red-700 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 追加悬赏金
              </button>
              {isOwner && (
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      try {
                        await api.hideBounty(bounty.id);
                        toast.success('已隐藏（悬赏榜不再展示，可随时恢复）');
                        navigate('/bounty');
                      } catch (e: any) { toast.error(e.message); }
                    }}
                    className="h-8 px-3 rounded-full bg-white/20 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <EyeOff className="w-3.5 h-3.5" /> 隐藏
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('确认删除该悬赏？将进入回收箱，15 天内可恢复。')) return;
                      try {
                        await api.deleteBounty(bounty.id);
                        toast.success('已删除（回收箱可恢复）');
                        navigate('/bounty');
                      } catch (e: any) { toast.error(e.message); }
                    }}
                    className="h-8 px-3 rounded-full bg-red-500/90 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 回复列表 */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-800">
            {bounty.answers.length} 条回复
          </div>
          {bounty.answers.length === 0 && (
            <div className="p-10 text-center text-xs text-gray-400">还没有人接取，快来抢首答</div>
          )}
          <div className="divide-y divide-gray-50">
            {bounty.answers.map((a: any) => (
              <div key={a.id} className={`p-4 ${a.status === 'accepted' ? 'bg-green-50/60' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar src={a.authorAvatar} alt={a.authorName} className="w-7 h-7" />
                  <span className="text-xs font-medium text-gray-800">{a.authorName}</span>
                  {a.authorRealm && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border text-gray-500 bg-gray-50">
                      {REALM_LABELS[a.authorRealm as keyof typeof REALM_LABELS] || a.authorRealm}
                    </span>
                  )}
                  {a.status === 'accepted' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">最佳答案</span>
                  )}
                  {a.payoutAmount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                      分红 ¥{a.payoutAmount}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400">{formatTime(new Date(a.createdAt).getTime())}</span>
                </div>
                <div className="text-xs text-gray-700 leading-relaxed mb-2.5 whitespace-pre-line">{a.content}</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => likeAnswer(a.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> {a.likeCount} 赞
                  </button>
                  {bounty.status === 'open' && (
                    <button
                      onClick={() => acceptAnswer(a.id)}
                      disabled={busy}
                      className="flex items-center gap-1 h-7 px-3 rounded-full bg-red-600 text-white text-[11px] font-medium disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3 h-3" /> 认可为最佳答案
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 接取回复 */}
        {bounty.status === 'open' && (
          <div className="bg-white rounded-2xl p-4">
            <div className="text-sm font-semibold text-gray-800 mb-2.5">接取任务 · 提交回复</div>
            <textarea
              className="w-full h-24 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-red-300"
              placeholder="你的解答（至少 5 个字），被认可可获 70% 赏金，被点赞可参与分红..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <button
              onClick={submitAnswer}
              disabled={busy}
              className="mt-2 w-full h-10 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 提交回复
            </button>
          </div>
        )}

        {accepted && (
          <div className="rounded-2xl bg-green-50 border border-green-100 p-4 text-xs text-green-700">
            悬赏已结束，最佳答案已认可，并自动生成了推荐问题（可在首页推荐中查看）。
          </div>
        )}
      </div>
    </div>
  );
}
