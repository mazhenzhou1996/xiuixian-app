import { useState, useEffect, useCallback } from 'react';
import { Heart, Pin, Sparkles, RefreshCw, Trash2, ShieldX, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type Filter = 'all' | 'featured' | 'pinned' | 'rejected';

/**
 * v31 后台：表白墙管理（删除 / 置顶 / 精选 / 驳回 / 编辑内容 / 处理举报）
 * 需先在 Supabase 执行 sql/confession_features_v31.sql
 */
export default function AdminConfessionsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // 编辑内容
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [editToName, setEditToName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'rejected' ? 'rejected' : 'all';
      let rows = await adminApi.adminListConfessions(status);
      if (filter === 'featured') rows = rows.filter((r: any) => r.featured);
      else if (filter === 'pinned') rows = rows.filter((r: any) => r.pinned);
      setList(rows);
    } catch (e: any) {
      toast.error(e?.message || '加载失败（需先执行SQL升级）');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async (id: number) => {
    if (!window.confirm('确认删除该表白？不可恢复。')) return;
    setBusyId(id);
    try { await adminApi.adminDeleteConfession(id); toast.success('已删除'); load(); }
    catch (e: any) { toast.error(e?.message || '操作失败'); }
    finally { setBusyId(null); }
  };
  const doPin = async (id: number) => {
    if (!window.confirm('确认由后台置顶该表白 24 小时（不扣费）？')) return;
    setBusyId(id);
    try { await adminApi.adminPinConfession(id, 1); toast.success('已置顶'); load(); }
    catch (e: any) { toast.error(e?.message || '操作失败'); }
    finally { setBusyId(null); }
  };
  const doFeature = async (id: number) => {
    if (!window.confirm('确认将表白精选上墙 24 小时？')) return;
    setBusyId(id);
    try { await adminApi.adminFeatureConfession(id, 1); toast.success('已精选'); load(); }
    catch (e: any) { toast.error(e?.message || '操作失败'); }
    finally { setBusyId(null); }
  };
  const doReject = async (id: number) => {
    if (!window.confirm('确认驳回（下架）该表白？')) return;
    setBusyId(id);
    try { await adminApi.adminRejectConfession(id); toast.success('已驳回'); load(); }
    catch (e: any) { toast.error(e?.message || '操作失败'); }
    finally { setBusyId(null); }
  };
  const doEdit = (c: any) => {
    setEditTarget(c);
    setEditContent(c.content || '');
    setEditToName(c.toName || '');
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await adminApi.adminUpdateConfession(editTarget.id, editContent.trim(), editToName.trim());
      toast.success('内容已更新');
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || '保存失败（需先执行SQL升级）');
    } finally {
      setEditSaving(false);
    }
  };

  const tabs: [Filter, string][] = [['all', '全部'], ['featured', '精选'], ['pinned', '置顶'], ['rejected', '已驳回']];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl p-1 flex border border-gray-100">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${filter === k ? 'bg-pink-600 text-white' : 'text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={load} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">暂无数据</div>
      ) : (
        <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
          {list.map((c: any) => (
            <div key={c.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                {c.featured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-pink-600"><Sparkles className="w-2.5 h-2.5 inline" /> 精选</span>}
                {c.pinned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600"><Pin className="w-2.5 h-2.5 inline" /> 置顶</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-50 text-green-600' : c.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                  {c.status === 'active' ? '展示中' : c.status}
                </span>
                {c.confirmedAt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600"><Heart className="w-2.5 h-2.5 inline" /> 已确认关系</span>}
                {(c.acceptedAt && !c.posterConfirmedAt) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">待表白人确认</span>}
                <span className="text-[10px] text-gray-400 ml-auto">{formatTime(new Date(c.createdAt).getTime())}</span>
              </div>
              <div className="text-sm text-gray-800 mt-1.5 leading-relaxed">
                {c.toName ? <span className="font-semibold text-pink-600">致 {c.toName}：</span> : ''}{c.content}
              </div>
              {c.storyUpdate ? (
                <div className="text-[11px] text-amber-600 mt-1.5">📖 {c.storyUpdate}</div>
              ) : null}
              <div className="text-[11px] text-gray-400 mt-1">
                作者 {String(c.userId).slice(0, 8)} · 喜欢 {c.likeCount} · 发布费 ¥{c.amount}
              </div>
              <div className="flex gap-2 flex-wrap mt-2.5">
                {c.status === 'active' && (
                  <>
                    <button onClick={() => doPin(c.id)} disabled={busyId === c.id} className="h-7 px-3 rounded-full bg-amber-50 text-amber-600 text-xs font-medium flex items-center gap-1 disabled:opacity-40">
                      <Pin className="w-3 h-3" /> 置顶
                    </button>
                    <button onClick={() => doFeature(c.id)} disabled={busyId === c.id} className="h-7 px-3 rounded-full bg-pink-50 text-pink-600 text-xs font-medium flex items-center gap-1 disabled:opacity-40">
                      <Sparkles className="w-3 h-3" /> 精选
                    </button>
                    <button onClick={() => doReject(c.id)} disabled={busyId === c.id} className="h-7 px-3 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center gap-1 disabled:opacity-40">
                      <ShieldX className="w-3 h-3" /> 驳回
                    </button>
                  </>
                )}
                <button onClick={() => doEdit(c)} className="h-7 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> 编辑
                </button>
                <button onClick={() => doDelete(c.id)} disabled={busyId === c.id} className="h-7 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1 disabled:opacity-40">
                  <Trash2 className="w-3 h-3" /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑内容弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5"><Pencil className="w-4 h-4 text-blue-500" /> 编辑表白内容</DialogTitle>
            <DialogDescription>修改后将直接更新展示内容，仅用于合规处理。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <input value={editToName} onChange={(e) => setEditToName(e.target.value)} maxLength={30} placeholder="表白对象（可为空）" className="w-full h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none" />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} maxLength={500} placeholder="表白内容*" className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm outline-none resize-none" />
          </div>
          <DialogFooter>
            <button onClick={() => setEditOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={saveEdit} disabled={editSaving} className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40">
              {editSaving ? '保存中...' : '保存'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
