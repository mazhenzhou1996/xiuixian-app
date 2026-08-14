import { useState, useEffect, useCallback } from 'react';
import { Crown, Heart, Loader2, Trophy, Sparkles, BadgeCheck, Coins } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { api } from '@/lib/api';
import { listBeautyActivities, getBeautyRanking, applyBeautyCandidate, voteBeauty } from '@/lib/features';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * 校花校草评选（v25）
 * 报名需本校认证；免费 1 票 + 付费加票（¥1=10 权重）；排行榜
 */
export default function BeautyContestPage() {
  usePageTitle('校花校草评选');
  const [activities, setActivities] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [photo, setPhoto] = useState('');
  const [slogan, setSlogan] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voteOpen, setVoteOpen] = useState<any>(null);
  const [voteCoin, setVoteCoin] = useState(0);

  const loadActivities = useCallback(async () => {
    try {
      const list = await listBeautyActivities();
      setActivities(list || []);
      if ((list || []).length > 0 && !activeId) setActiveId((list[0] as any).id);
    } catch { /* 迁移未执行时静默 */ }
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  useEffect(() => {
    if (!activeId) return;
    getBeautyRanking(activeId).then(setDetail).catch(() => {});
  }, [activeId]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setPhoto(url);
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const submitApply = async () => {
    if (!activeId) return;
    if (!photo) { toast.error('请上传照片'); return; }
    setBusy(true);
    try {
      await applyBeautyCandidate(activeId, photo, slogan.trim());
      toast.success('报名成功，等待后台审核');
      setApplyOpen(false);
      setPhoto('');
      setSlogan('');
    } catch (e: any) {
      toast.error(e?.message || '报名失败');
    } finally {
      setBusy(false);
    }
  };

  const submitVote = async () => {
    if (!activeId || !voteOpen) return;
    setBusy(true);
    try {
      const res = await voteBeauty(activeId, voteOpen.id, voteCoin);
      toast.success(`投票成功（权重 +${res?.weight || 1}）`);
      setVoteOpen(null);
      setVoteCoin(0);
      getBeautyRanking(activeId).then(setDetail).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || '投票失败');
    } finally {
      setBusy(false);
    }
  };

  const act = detail?.activity;
  const ranking = detail?.ranking || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="校花校草评选" />

      {/* 活动切换 */}
      {activities.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1">
          {activities.map((a: any) => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${activeId === a.id ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              {a.title}
              {a.status === 'ended' && '（已结束）'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          暂无评选活动，敬请期待
        </div>
      ) : act ? (
        <div className="px-4 py-3 space-y-3">
          {/* 活动头 */}
          <div className="rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white px-4 py-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5" />
              <div className="text-base font-bold">{act.title}</div>
            </div>
            <div className="text-[11px] text-pink-100 mt-1">
              {act.gender === 'female' ? '校花' : '校草'}评选 · 报名需本校认证修士
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-pink-100">
              <span>🗳 免费 1 票/人</span>
              <span>💰 加票 ¥1 = 10 权重</span>
            </div>
          </div>

          {/* 操作 */}
          <div className="flex gap-2">
            <button
              onClick={() => setApplyOpen(true)}
              className="flex-1 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold hover:brightness-105"
            >
              我要报名
            </button>
          </div>

          {/* 排行榜 */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <Trophy className="w-4 h-4 text-amber-500" />
              人气排行榜（{ranking.length}）
            </div>
            {ranking.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">暂无选手，快来报名</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ranking.map((c: any, i: number) => (
                  <div key={c.id} className="p-3.5 flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    {c.photo ? (
                      <img src={c.photo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <Avatar src={c.avatar} alt={c.nickname} className="w-12 h-12 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{c.nickname}</span>
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {c.school && <span className="text-[10px] text-gray-400 truncate">{c.school}</span>}
                      </div>
                      {c.slogan && <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{c.slogan}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-pink-600 flex items-center gap-0.5">
                        <Heart className="w-3.5 h-3.5 fill-current" /> {c.votes}
                      </div>
                      <button
                        onClick={() => setVoteOpen(c)}
                        disabled={act.status === 'ended'}
                        className="mt-1 h-7 px-3 rounded-full bg-pink-50 text-pink-600 text-xs font-medium hover:bg-pink-100 disabled:opacity-40"
                      >
                        投票
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
            投票规则：每人每活动免费 1 票；付费加票 ¥1 = 10 权重（余额支付，平台收入）。投票结果实时更新。
          </p>
        </div>
      ) : null}

      {/* 报名弹窗 */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-500" />
              报名参赛
            </DialogTitle>
            <DialogDescription>仅本校认证修士可报名（未认证请先到学校圈子申请认证）</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" id="cand-photo" />
            <label htmlFor="cand-photo" className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-pink-200 bg-pink-50/40 cursor-pointer hover:bg-pink-50">
              {photo ? (
                <img src={photo} alt="" className="h-full rounded-xl object-cover" />
              ) : (
                <span className="text-xs text-pink-400">{uploading ? '上传中...' : '点击上传参赛照片 *'}</span>
              )}
            </label>
            <input value={slogan} onChange={(e) => setSlogan(e.target.value)} maxLength={50} placeholder="参赛宣言（可选，50 字内）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          </div>
          <DialogFooter>
            <button onClick={() => setApplyOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submitApply} disabled={busy} className="h-9 px-6 bg-pink-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {busy ? '提交中...' : '提交报名'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 投票弹窗 */}
      <Dialog open={!!voteOpen} onOpenChange={(o) => !o && setVoteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-500" />
              给 {voteOpen?.nickname} 投票
            </DialogTitle>
            <DialogDescription>免费 1 票（每人每活动一次）；可付费加票加速（¥1 = 10 权重）</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 text-sm text-pink-700">
            本次将投出：1 免费票{voteCoin > 0 ? ` + ${voteCoin * 10} 权重（¥${voteCoin}）` : ''}
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              type="number"
              value={voteCoin || ''}
              onChange={(e) => setVoteCoin(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
              min={0}
              max={20}
              placeholder="付费加票金额（¥0-20，可选）"
              className="flex-1 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setVoteOpen(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submitVote} disabled={busy} className="h-9 px-6 bg-pink-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {busy ? '投票中...' : '确认投票'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
