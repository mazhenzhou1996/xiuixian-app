import { useState, useEffect, useCallback } from 'react';
import { Heart, Pin, Sparkles, Send, Loader2, ShieldQuestion, Flag, Trash2, Pencil, CheckCircle2, ImagePlus, CircleCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import {
  listConfessions, payCreateConfession, pinConfessionPaid, featureConfession, toggleConfessionLike,
  deleteMyConfession, updateConfessionStory, confirmConfession, acceptConfession,
} from '@/lib/features';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * 表白墙（v31）
 * 发布 ¥1（余额）· 置顶 ¥5/天 · 精选（免费上墙）
 * 双方确认关系：被表白人接受 → 表白人确认 → 双方均可传截图 / 补充后续
 * 本人（表白人）可删除；被表白人 + 其他人均可举报；后台可编辑内容 / 处理
 */
type FeedFilter = 'featured' | 'mine' | 'all';

export default function ConfessionWallPage() {
  usePageTitle('表白墙');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const mySchool = store.getSelectedSchool();
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('featured');
  const [items, setItems] = useState<any[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState({ to_name: '', content: '', is_anonymous: true });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState('');

  // 举报
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportText, setReportText] = useState('');

  // 补充故事后续
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyTarget, setStoryTarget] = useState<any>(null);
  const [storyText, setStoryText] = useState('');
  const [storySaving, setStorySaving] = useState(false);

  // 双方确认关系（被表白人接受 / 表白人确认，二选一弹窗）
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRole, setConfirmRole] = useState<'target' | 'poster' | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [confirmImage, setConfirmImage] = useState('');
  const [confirmUploading, setConfirmUploading] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      if (feedFilter === 'mine') {
        data = await listConfessions(50, 0, mySchool?.id ?? null);
      } else {
        data = await listConfessions(60, 0, null);
        if (feedFilter === 'featured') {
          // 精选故事：只展示「被精选 / 有故事后续 / 双方已确认」的表白，突出续写与确认
          data = data.filter((c: any) => c.featured || c.story_update || (c.accepted_at && c.poster_confirmed_at));
        }
        data = [...data].sort((a, b) => {
          const fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0;
          if (fa !== fb) return fb - fa;
          const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
          if (pa !== pb) return pb - pa;
          return feedFilter === 'featured'
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : (b.like_count || 0) - (a.like_count || 0);
        });
      }
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
    if (currentUser) {
      try {
        const likes = await api.getMyLikes();
        setLikedSet(new Set(likes.filter((l: any) => l.targetType === 'confession').map((l: any) => String(l.targetId))));
      } catch { /* ignore */ }
    }
  }, [currentUser?.id, feedFilter, mySchool?.id]);

  useEffect(() => { load(); }, [load]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setImage(url);
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (form.content.trim().length < 2) { toast.error('内容至少2个字'); return; }
    try {
      const w = await api.getMyWallet();
      const bal = (w as any)?.balance ?? 0;
      if (bal < 1) {
        if (window.confirm('余额不足 ¥1，是否去充值？')) window.location.hash = '#/consult-center';
        return;
      }
    } catch { /* ignore */ }
    setSubmitting(true);
    try {
      await payCreateConfession({
        content: form.content.trim(), toName: form.to_name.trim(),
        isAnonymous: form.is_anonymous, image, schoolId: mySchool?.id ?? null, amount: 1,
      });
      toast.success('已提交，审核通过后展示（避免不当内容）');
      setPublishOpen(false);
      setForm({ to_name: '', content: '', is_anonymous: true });
      setImage('');
      load();
    } catch (e: any) {
      toast.error(e?.message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const doLike = async (item: any) => {
    if (!currentUser) { toast.info('请先登录'); return; }
    try {
      const liked = await toggleConfessionLike(item.id);
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (liked) next.add(String(item.id)); else next.delete(String(item.id));
        return next;
      });
      setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, like_count: Math.max(0, x.like_count + (liked ? 1 : -1)) } : x));
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const doPin = async (item: any) => {
    if (!window.confirm('置顶 24 小时需支付 ¥5（余额），确定？')) return;
    try {
      await pinConfessionPaid(item.id, 1, 5);
      toast.success('已置顶 24 小时');
      load();
    } catch (e: any) {
      toast.error(e?.message || '置顶失败');
    }
  };

  const doFeature = async (item: any) => {
    if (!window.confirm('将该表白精选上墙（管理员/作者可操作），确定？')) return;
    try {
      await featureConfession(item.id, 1);
      toast.success('已精选上墙');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const doDelete = async (item: any) => {
    if (!window.confirm('确认删除这条表白？删除后不可恢复。')) return;
    try {
      await deleteMyConfession(item.id);
      toast.success('已删除');
      load();
    } catch (e: any) {
      toast.error(e?.message || '删除失败（需先在后台执行SQL升级）');
    }
  };

  const saveStory = async () => {
    if (!storyTarget) return;
    setStorySaving(true);
    try {
      await updateConfessionStory(storyTarget.id, storyText.trim());
      toast.success('故事后续已更新');
      setStoryOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || '保存失败（需先执行SQL升级）');
    } finally {
      setStorySaving(false);
    }
  };

  // 被表白人接受
  const doAccept = (item: any) => {
    setConfirmRole('target');
    setConfirmTarget(item);
    setConfirmImage('');
    setConfirmOpen(true);
  };
  // 表白人确认
  const doPosterConfirm = (item: any) => {
    setConfirmRole('poster');
    setConfirmTarget(item);
    setConfirmImage('');
    setConfirmOpen(true);
  };

  const handleConfirmImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setConfirmUploading(true);
    try {
      const url = await api.uploadImage(file);
      setConfirmImage(url);
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败');
    } finally {
      setConfirmUploading(false);
    }
  };

  const saveConfirm = async () => {
    if (!confirmTarget || !confirmRole) return;
    setConfirmSaving(true);
    try {
      const fn = confirmRole === 'target' ? acceptConfession : confirmConfession;
      const res: any = await fn(confirmTarget.id, confirmImage);
      toast.success(res?.confirmed ? '双方已确认关系 ❤️' : (confirmRole === 'target' ? '已接受，待表白人确认' : '已确认，待对方接受'));
      setConfirmOpen(false);
      setConfirmImage('');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败（需先在后台执行SQL升级）');
    } finally {
      setConfirmSaving(false);
    }
  };

  const submitReport = async () => {
    if (!currentUser) { toast.info('请先登录'); return; }
    try {
      await api.submitReport({
        targetType: 'confession',
        targetId: String(reportTarget.id),
        targetUserId: reportTarget.user_id ? String(reportTarget.user_id) : undefined,
        reason: reportText.trim() || '违规内容',
        content: reportText.trim(),
      });
      toast.success('举报已提交，我们会尽快处理');
      setReportOpen(false);
      setReportText('');
    } catch (e: any) {
      toast.error(e?.message || '举报提交失败');
    }
  };

  const isMine = (item: any) => currentUser && String(item.user_id) === String(currentUser.id);
  const relConfirmed = (item: any) => item.confirmed_at || (item.accepted_at && item.poster_confirmed_at);
  // 关系状态
  const relStatus = (item: any) => {
    if (relConfirmed(item)) return { label: '💞 双方已确认关系', tone: 'text-rose-600 bg-rose-50' };
    if (item.accepted_at && !item.poster_confirmed_at) return { label: '对方已接受 · 待表白人确认', tone: 'text-amber-600 bg-amber-50' };
    if (!item.accepted_at && item.poster_confirmed_at) return { label: '表白人已确认 · 待对方接受', tone: 'text-amber-600 bg-amber-50' };
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <PageHeader
        title="表白墙"
        rightAction={
          <button onClick={() => setPublishOpen(true)} className="h-8 px-4 bg-pink-600 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-sm">
            <Send className="w-3.5 h-3.5" /> 表白
          </button>
        }
      />

      {/* 顶部筛选：精选(默认) / 本校 / 全部 */}
      <div className="px-4 pt-3 flex gap-2 sticky top-12 z-20 bg-gray-50">
        {([
          { k: 'featured', label: '精选' },
          { k: 'mine', label: `本校${mySchool?.name ? `（${mySchool.name}）` : ''}` },
          { k: 'all', label: '全部学校' },
        ] as { k: FeedFilter; label: string }[]).map((t) => (
          <button
            onClick={() => setFeedFilter(t.k)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${feedFilter === t.k ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {t.k === 'featured' && <Sparkles className="w-3 h-3 inline mr-0.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* 顶部精选故事 banner */}
      {feedFilter === 'featured' && items.length > 0 && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" /> 精选故事
            </div>
            <div className="text-[11px] text-white/85 mb-1.5">续写故事后续 · 双方确认关系 · 暖心表白合集</div>
            {items.filter((x) => x.featured).slice(0, 3).map((x) => (
              <div key={x.id} className="text-sm leading-relaxed line-clamp-1">
                💌 {x.to_name ? `致 ${x.to_name}：` : ''}{x.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 时间流 */}
      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">
            {feedFilter === 'featured'
              ? '还没有精选故事，去发布表白并申请精选 / 补充后续吧 ❤️'
              : '还没有表白，勇敢说出第一句吧 ❤️'}
          </div>
        ) : (
          items.map((c: any) => {
            const rs = relStatus(c);
            const canTargetStory = c.accepted_at || relConfirmed(c); // 被表白人接受后可补充后续
            return (
            <div key={c.id} className={`bg-white rounded-2xl p-4 border transition-shadow ${c.featured ? 'border-pink-300 shadow-md shadow-pink-100' : c.pinned ? 'border-amber-300 shadow-md shadow-amber-100' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {c.featured && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">
                    <Sparkles className="w-2.5 h-2.5" /> 精选
                  </span>
                )}
                {c.pinned && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    <Pin className="w-2.5 h-2.5" /> 置顶
                  </span>
                )}
                {rs && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full ${rs.tone}`}>
                    <Heart className="w-2.5 h-2.5 fill-current" /> {rs.label}
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                  {c.is_anonymous ? '匿名' : (c.user_nickname || '用户')}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">{formatTime(new Date(c.created_at).getTime())}</span>
              </div>
              <div className="text-sm text-gray-800 leading-relaxed">
                {c.to_name && <span className="font-semibold text-pink-600">致 {c.to_name}：</span>}
                {c.content}
              </div>
              {c.image && <img src={c.image} alt="" className="mt-2 max-h-40 rounded-xl object-cover" loading="lazy" />}

              {/* 故事后续 */}
              {c.story_update ? (
                <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <div className="text-[10px] text-amber-600 font-medium mb-0.5">📖 故事后续</div>
                  <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{c.story_update}</div>
                </div>
              ) : null}

              {/* 双方确认截图 */}
              {c.confirm_screenshot_a ? (
                <div className="mt-2">
                  <div className="text-[10px] text-rose-500 mb-1">表白人 · 关系截图</div>
                  <img src={c.confirm_screenshot_a} alt="表白人确认截图" className="max-h-40 rounded-xl object-cover border border-rose-100" loading="lazy" />
                </div>
              ) : null}
              {c.confirm_screenshot_b ? (
                <div className="mt-2">
                  <div className="text-[10px] text-rose-500 mb-1">被表白人 · 关系截图</div>
                  <img src={c.confirm_screenshot_b} alt="被表白人确认截图" className="max-h-40 rounded-xl object-cover border border-rose-100" loading="lazy" />
                </div>
              ) : null}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  onClick={() => doLike(c)}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${likedSet.has(String(c.id)) ? 'text-pink-600' : 'text-gray-400 hover:text-pink-600'}`}
                >
                  <Heart className={`w-4 h-4 ${likedSet.has(String(c.id)) ? 'fill-current' : ''}`} />
                  {c.like_count > 0 ? c.like_count : '喜欢'}
                </button>

                {!isMine(c) && (
                  <button
                    onClick={() => { setReportTarget(c); setReportText(''); setReportOpen(true); }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                  >
                    <Flag className="w-3.5 h-3.5" /> 举报
                  </button>
                )}

                {isMine(c) ? (
                  <>
                    {!c.accepted_at && (
                      <span className="text-[10px] text-gray-300 flex items-center gap-0.5">
                        <ShieldQuestion className="w-3 h-3" /> 待被表白人接受
                      </span>
                    )}
                    {c.accepted_at && !c.poster_confirmed_at && (
                      <button onClick={() => doPosterConfirm(c)} className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700">
                        <CircleCheck className="w-3.5 h-3.5" /> 确认关系
                      </button>
                    )}
                    {c.poster_confirmed_at && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> 你已确认</span>
                    )}
                    <button
                      onClick={() => { setStoryTarget(c); setStoryText(c.story_update || ''); setStoryOpen(true); }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Pencil className="w-3.5 h-3.5" /> 补充后续
                    </button>
                    {!c.pinned && (
                      <button onClick={() => doPin(c)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                        <Pin className="w-3.5 h-3.5" /> 置顶 ¥5/天
                      </button>
                    )}
                    {!c.featured && (
                      <button onClick={() => doFeature(c)} className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700">
                        <Sparkles className="w-3.5 h-3.5" /> 精选上墙
                      </button>
                    )}
                    <button onClick={() => doDelete(c)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </>
                ) : (
                  <>
                    {!c.accepted_at && (
                      <button onClick={() => doAccept(c)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                        <CircleCheck className="w-3.5 h-3.5" /> 我是被表白人 · 接受
                      </button>
                    )}
                    {c.accepted_at && canTargetStory && (
                      <button
                        onClick={() => { setStoryTarget(c); setStoryText(c.story_update || ''); setStoryOpen(true); }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <Pencil className="w-3.5 h-3.5" /> 补充后续
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* 醒目大按钮：发布表白（底部吸底） */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={() => setPublishOpen(true)}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white text-base font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
        >
          <Heart className="w-5 h-5 fill-current" /> 发布表白 · ¥1
        </button>
      </div>

      {/* 发布弹窗 */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-500" />
              发布表白
            </DialogTitle>
            <DialogDescription>发布需 ¥1（从余额扣除）· 置顶 ¥5/天 · 精选免费上墙（需审核通过）</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <input value={form.to_name} onChange={(e) => setForm({ ...form, to_name: e.target.value })} maxLength={30} placeholder="表白对象（可选，如：图书馆3楼的小姐姐）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} maxLength={500} placeholder="想说的话（2-500 字）*" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
            <div className="flex items-center justify-between rounded-xl bg-pink-50 border border-pink-100 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-700">匿名发布</div>
                <div className="text-[11px] text-gray-400 mt-0.5">默认开启，保护你的隐私</div>
              </div>
              <button
                onClick={() => setForm({ ...form, is_anonymous: !form.is_anonymous })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_anonymous ? 'bg-pink-500' : 'bg-gray-200'}`}
                aria-pressed={form.is_anonymous}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.is_anonymous ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" id="conf-img" />
              <label htmlFor="conf-img" className="h-9 px-4 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1 cursor-pointer">
                {uploading ? '上传中...' : image ? '已上传图片 ✓' : '配图（可选）'}
              </label>
              {image && <button onClick={() => setImage('')} className="text-xs text-red-400">移除</button>}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setPublishOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submit} disabled={submitting} className="h-9 px-6 bg-pink-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {submitting ? '发布中...' : '支付 ¥1 并发布'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 举报弹窗 */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-red-500" /> 举报这条表白</DialogTitle>
            <DialogDescription>请描述违规原因，提交后由管理员处理。</DialogDescription>
          </DialogHeader>
          <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={4} maxLength={300} placeholder="如：辱骂、骚扰、不实信息、涉及隐私等" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
          <DialogFooter>
            <button onClick={() => setReportOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submitReport} className="h-9 px-6 bg-red-500 text-white text-sm font-medium rounded-full">提交举报</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 补充故事后续弹窗 */}
      <Dialog open={storyOpen} onOpenChange={setStoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5"><Pencil className="w-4 h-4 text-blue-500" /> 补充故事后续</DialogTitle>
            <DialogDescription>给这个表白续写后续进展，读者能在精选里看到。</DialogDescription>
          </DialogHeader>
          <textarea value={storyText} onChange={(e) => setStoryText(e.target.value)} rows={4} maxLength={1000} placeholder="例如：一年后我们在一起了……" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
          <DialogFooter>
            <button onClick={() => setStoryOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={saveStory} disabled={storySaving} className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {storySaving ? '保存中...' : '保存后续'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 双方确认关系弹窗（被表白人接受 / 表白人确认） */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <CircleCheck className="w-4 h-4 text-rose-500" />
              {confirmRole === 'target' ? '被表白人 · 接受表白' : '表白人 · 确认关系'}
            </DialogTitle>
            <DialogDescription>
              {confirmRole === 'target'
                ? '你是被表白人，确认接受这份表白并上传双方关系截图（可选）。'
                : '你是表白人，确认这段关系并上传双方关系截图（可选）。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-[11px] text-rose-600">
              {confirmRole === 'target'
                ? '接受后，等待表白人确认即可标记为「双方已确认关系」。'
                : '表白人确认后，若对方已接受，即标记为「双方已确认关系」。'}
            </div>
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handleConfirmImage} className="hidden" id="conf-confirm-img" />
              <label htmlFor="conf-confirm-img" className="h-9 px-4 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1 cursor-pointer">
                {confirmUploading ? '上传中...' : confirmImage ? '已上传截图 ✓' : <><ImagePlus className="w-3.5 h-3.5" /> 上传截图</>}
              </label>
              {confirmImage && <button onClick={() => setConfirmImage('')} className="text-xs text-red-400">移除</button>}
            </div>
            {relConfirmed(confirmTarget) && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium"><CheckCircle2 className="w-4 h-4" /> 双方已确认关系 ❤️</div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setConfirmOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={saveConfirm} disabled={confirmSaving} className="h-9 px-6 bg-rose-500 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {confirmSaving ? '保存中...' : (confirmRole === 'target' ? '接受并确认' : '确认关系')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
