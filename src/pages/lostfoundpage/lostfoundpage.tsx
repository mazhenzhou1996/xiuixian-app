import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Pin, CheckCircle2, PackageSearch, HeartHandshake, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { listLostItems, createLostItem, pinLostItem, resolveLostItem } from '@/lib/features';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * 失物招领（v25）
 * 拾到（免费发布）+ 寻物（免费发布 + 付费置顶 ¥1/天，平台收入，无资金托管）
 */
export default function LostFoundPage() {
  usePageTitle('失物招领');
  const store = useXiuxianStore();
  const [tab, setTab] = useState<'all' | 'lost' | 'found'>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'lost' as 'lost' | 'found', category: '其他', title: '', description: '', location: '', contact: '', reward: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listLostItems(tab, 30, 0));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

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
    if (form.title.trim().length < 2) { toast.error('标题至少2个字'); return; }
    setSubmitting(true);
    try {
      await createLostItem({ ...form, image, title: form.title.trim(), reward: form.reward || 0 });
      toast.success(form.kind === 'lost' ? '寻物信息已发布' : '拾到信息已发布');
      setPublishOpen(false);
      setForm({ kind: 'lost', category: '其他', title: '', description: '', location: '', contact: '', reward: 0 });
      setImage('');
      load();
    } catch (e: any) {
      toast.error(e?.message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const doPin = async (item: any) => {
    if (!window.confirm('置顶 24 小时需支付 ¥1（余额），确定？')) return;
    try {
      await pinLostItem(item.id, 1);
      toast.success('已置顶 24 小时');
      load();
    } catch (e: any) {
      toast.error(e?.message || '置顶失败');
    }
  };

  const doResolve = async (item: any) => {
    if (!window.confirm('确认已找到/已归还？信息将标记为已解决。')) return;
    try {
      await resolveLostItem(item.id);
      toast.success('已标记解决');
      load();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const currentUser = store.getCurrentUser();
  const isMine = (item: any) => currentUser && String(item.user_id) === String(currentUser.id);

  const tabs = [
    { key: 'all' as const, label: '全部' },
    { key: 'lost' as const, label: '寻物' },
    { key: 'found' as const, label: '拾到' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="失物招领"
        rightAction={
          <button onClick={() => setPublishOpen(true)} className="h-7 px-4 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> 发布
          </button>
        }
      />

      {/* 说明条 */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-3 flex items-center gap-2.5">
          <PackageSearch className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">校园失物招领</div>
            <div className="text-[11px] text-teal-50">拾到免费发布 · 寻物免费发布 · 置顶加急 ¥1/天</div>
          </div>
          <HeartHandshake className="w-5 h-5 opacity-70" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-1 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">
            暂无信息，发布第一条吧
          </div>
        ) : (
          items.map((it: any) => (
            <div key={it.id} className={`bg-white rounded-2xl p-4 border transition-shadow ${it.pinned ? 'border-amber-300 shadow-md shadow-amber-100' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${it.kind === 'lost' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                  {it.kind === 'lost' ? '寻物' : '拾到'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">{it.category}</span>
                {it.pinned && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    <Pin className="w-2.5 h-2.5" /> 置顶
                  </span>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">{formatTime(new Date(it.created_at).getTime())}</span>
              </div>
              <div className="flex gap-3">
                {it.image && <img src={it.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{it.title}</div>
                  {it.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{it.description}</div>}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1.5">
                    {it.location && <span>📍 {it.location}</span>}
                    <span className="flex items-center gap-1">
                      <Avatar src={it.user_avatar} alt={it.user_nickname} className="w-4 h-4" />
                      {it.user_nickname}
                    </span>
                  </div>
                  {it.reward > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
                      💰 寻物悬赏 ¥{it.reward}（找到后线下结算）
                    </div>
                  )}
                </div>
              </div>
              {it.contact && (
                <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">📞 联系：{it.contact}</div>
              )}
              {isMine(it) && (
                <div className="flex gap-2 mt-2.5">
                  {!it.pinned && (
                    <button onClick={() => doPin(it)} className="h-7 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium flex items-center gap-1">
                      <Pin className="w-3 h-3" /> 置顶 ¥1/天
                    </button>
                  )}
                  <button onClick={() => doResolve(it)} className="h-7 px-3 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 已找到/已归还
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 发布弹窗 */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Search className="w-4 h-4 text-teal-500" />
              发布失物招领
            </DialogTitle>
            <DialogDescription>拾到免费发布；寻物免费发布 + 可付费置顶加急（¥1/天，平台收入）</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            {([['lost', '我在找物品'], ['found', '我拾到了物品']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k })}
                className={`flex-1 h-10 rounded-xl border text-sm font-medium ${form.kind === k ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none">
              {['其他', '证件', '手机', '钱包', '书籍', '钥匙', '耳机', '衣物', '雨伞', '电脑'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="地点（如：图书馆 3 楼）" className="h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题 *（如：丢失校园卡，姓名王小明）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="详细描述（可选）" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
          <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="联系方式（可选，展示给认领人）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          {form.kind === 'lost' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.reward || ''}
                onChange={(e) => setForm({ ...form, reward: Math.min(500, Math.max(0, Number(e.target.value) || 0)) })}
                min={0}
                max={500}
                placeholder="寻物悬赏金额（0-500，可选）"
                className="flex-1 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
              />
              <span className="text-xs text-gray-400">元</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" id="lost-img" />
            <label htmlFor="lost-img" className="h-9 px-4 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1 cursor-pointer">
              {uploading ? '上传中...' : image ? '已上传图片 ✓' : '上传图片（可选）'}
            </label>
            {image && <button onClick={() => setImage('')} className="text-xs text-red-400">移除</button>}
          </div>
          <DialogFooter>
            <button onClick={() => setPublishOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={submit} disabled={submitting} className="h-9 px-6 bg-teal-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {submitting ? '发布中...' : '免费发布'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
