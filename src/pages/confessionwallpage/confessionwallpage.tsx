import { useState, useEffect, useCallback } from 'react';
import { Heart, Pin, Sparkles, Send, Loader2, ShieldQuestion } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { listConfessions, createConfession, pinConfession, featureConfession, toggleConfessionLike } from '@/lib/features';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * 表白墙（v26）
 * 免费发布（默认匿名）· 置顶 ¥2/天 · 精选 ¥5/天（墙顶 banner，审核通过后可精选）
 */
export default function ConfessionWallPage() {
  usePageTitle('表白墙');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [items, setItems] = useState<any[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // v29：表白墙默认本校推荐，可切换全部
  const [schoolFilter, setSchoolFilter] = useState<'mine' | 'all'>('mine');
  const mySchool = store.getSelectedSchool();
  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState({ to_name: '', content: '', is_anonymous: true });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sid = schoolFilter === 'mine' ? (mySchool?.id ?? null) : null;
      setItems(await listConfessions(30, 0, sid));
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
  }, [currentUser?.id, schoolFilter, mySchool?.id]);

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
    setSubmitting(true);
    try {
      const mySchool = store.getSelectedSchool();
      await createConfession({
        content: form.content.trim(), toName: form.to_name.trim(),
        isAnonymous: form.is_anonymous, image, schoolId: mySchool?.id ?? null,
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
    if (!window.confirm('置顶 24 小时需支付 ¥2（余额），确定？')) return;
    try {
      await pinConfession(item.id, 1);
      toast.success('已置顶 24 小时');
      load();
    } catch (e: any) {
      toast.error(e?.message || '置顶失败');
    }
  };

  const doFeature = async (item: any) => {
    if (!window.confirm('精选 24 小时需支付 ¥5（余额），将展示在墙顶 banner 位，确定？')) return;
    try {
      await featureConfession(item.id, 1);
      toast.success('已精选 24 小时');
      load();
    } catch (e: any) {
      toast.error(e?.message || '精选失败');
    }
  };

  const isMine = (item: any) => currentUser && String(item.user_id) === String(currentUser.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="表白墙"
        rightAction={
          <button onClick={() => setPublishOpen(true)} className="h-7 px-4 bg-pink-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> 表白
          </button>
        }
      />

      {/* v29：本校/全部 过滤（默认本校推荐） */}
      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setSchoolFilter('mine')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${schoolFilter === 'mine' ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
        >
          🏫 本校{mySchool?.name ? `（${mySchool.name}）` : ''}
        </button>
        <button
          onClick={() => setSchoolFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${schoolFilter === 'all' ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
        >
          全部学校
        </button>
      </div>

      {/* 顶部精选 banner */}
      {items.filter((x) => x.featured).length > 0 && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 text-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" /> 精选表白
            </div>
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
            还没有表白，勇敢说出第一句吧 ❤️
          </div>
        ) : (
          items.map((c: any) => (
            <div key={c.id} className={`bg-white rounded-2xl p-4 border transition-shadow ${c.featured ? 'border-pink-300 shadow-md shadow-pink-100' : c.pinned ? 'border-amber-300 shadow-md shadow-amber-100' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                  {c.is_anonymous ? '匿名' : c.user_nickname}
                </span>
                <span className="text-[10px] text-gray-400 ml-auto">{formatTime(new Date(c.created_at).getTime())}</span>
              </div>
              <div className="text-sm text-gray-800 leading-relaxed">
                {c.to_name && <span className="font-semibold text-pink-600">致 {c.to_name}：</span>}
                {c.content}
              </div>
              {c.image && <img src={c.image} alt="" className="mt-2 max-h-40 rounded-xl object-cover" loading="lazy" />}
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => doLike(c)}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${likedSet.has(String(c.id)) ? 'text-pink-600' : 'text-gray-400 hover:text-pink-600'}`}
                >
                  <Heart className={`w-4 h-4 ${likedSet.has(String(c.id)) ? 'fill-current' : ''}`} />
                  {c.like_count > 0 ? c.like_count : '喜欢'}
                </button>
                {isMine(c) && (
                  <>
                    {!c.pinned && (
                      <button onClick={() => doPin(c)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                        <Pin className="w-3.5 h-3.5" /> 置顶 ¥2/天
                      </button>
                    )}
                    {!c.featured && (
                      <button onClick={() => doFeature(c)} className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700">
                        <Sparkles className="w-3.5 h-3.5" /> 精选 ¥5/天
                      </button>
                    )}
                  </>
                )}
                {!isMine(c) && (
                  <span className="ml-auto text-[10px] text-gray-300 flex items-center gap-0.5">
                    <ShieldQuestion className="w-3 h-3" /> 已保护匿名
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 发布弹窗 */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-500" />
              发布表白
            </DialogTitle>
            <DialogDescription>免费发布（默认匿名）· 置顶 ¥2/天 · 精选 ¥5/天（需审核通过）</DialogDescription>
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
              {submitting ? '发布中...' : '免费发布'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
