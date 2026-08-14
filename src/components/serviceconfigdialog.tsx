import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Eye, EyeOff, Save, ArrowUp, ArrowDown, Lock } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { ServiceIcon, ICON_KEYS } from '@/lib/iconmap';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const TOPICS = [
  { key: 'university', label: '大学专题' },
  { key: 'graduate', label: '研究生专题' },
];

const EMPTY = { id: 0, topic: 'university', label: '', icon: 'Sparkles', url: '', description: '', ad_unlock: false, sort_order: 0, enabled: true, fixed: false };

/**
 * 九宫格服务项配置弹窗（v18）
 * - 功能排序（上下移动/排序号）、图标符号、广告解锁开关、显示/隐藏开关
 * - 「付费咨询学长学姐」为固定项：🔒 不可删除/改名/隐藏/排序，永远第一
 * - 从高校管理页打开（原独立「九宫格配置」菜单已移除）
 */
export default function ServiceConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [topic, setTopic] = useState('university');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (t: string) => {
    setLoading(true);
    try {
      const svc = await adminApi.listServices(t);
      // 固定项永远排第一（服务端已保证 sort_order=0，前端再兜底）
      const sorted = [...(svc || [])].sort((a, b) => (b.fixed ? 0 : 1) - (a.fixed ? 0 : 1) || (a.sort_order || 0) - (b.sort_order || 0));
      setRows(sorted);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic]);

  const patch = (id: number | null, field: string, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id || (id === null && r._new) ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    setRows((prev) => [...prev, { ...EMPTY, topic, sort_order: maxSort + 1, _new: true }]);
  };

  const removeRow = async (r: any) => {
    if (r.fixed) { toast.info('「付费咨询学长学姐」为固定项，不可删除'); return; }
    if (!r.id) { setRows((prev) => prev.filter((x) => x !== r)); return; }
    if (!window.confirm(`确认删除「${r.label}」？可在变更回滚中恢复。`)) return;
    try {
      await adminApi.deleteService(r.id);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success('已删除（可回滚恢复）');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      // 固定项不允许移动
      if (next[idx].fixed || next[idx + dir]?.fixed) return prev;
      const t = next[idx + dir];
      if (!t) return prev;
      const cur = next[idx];
      const curSort = cur.sort_order;
      next[idx] = { ...t, sort_order: curSort };
      next[idx + dir] = { ...cur, sort_order: t.sort_order };
      return next;
    });
  };

  const saveAll = async () => {
    const invalid = rows.find((r) => !r.fixed && !r.label.trim());
    if (invalid) { toast.error('有服务名称为空，请填写后再保存'); return; }
    setSaving(true);
    try {
      for (const r of rows) {
        await adminApi.saveService(
          { id: r.id, topic, label: r.label.trim(), icon: r.icon || 'Sparkles', url: r.url || '', description: r.description || '', ad_unlock: !!r.ad_unlock, sort_order: r.fixed ? 0 : (r.sort_order || 0), enabled: r.fixed ? true : r.enabled !== false, fixed: !!r.fixed },
          !r.id
        );
      }
      toast.success(`已保存 ${rows.length} 项`);
      load(topic);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-blue-300 bg-white disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-500" />
            九宫格功能配置
          </DialogTitle>
          <DialogDescription>
            功能排序 / 图标符号 / 广告解锁开关 / 显示隐藏。付费咨询学长学姐为固定项（🔒 不可删改，永远第一）。
          </DialogDescription>
        </DialogHeader>

        {/* 专题切换 */}
        <div className="bg-white rounded-xl p-1 flex border border-gray-100">
          {TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTopic(t.key)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${topic === t.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="max-h-[55vh] overflow-y-auto">
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-800">九宫格服务（{rows.length} 项）</div>
              <button onClick={addRow} className="h-8 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 新增服务
              </button>
            </div>

            {loading && rows.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {rows.map((r, idx) => (
                <div key={r.id || `new-${idx}`} className={`px-4 py-3 ${r.enabled ? '' : 'opacity-60'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-[36px_1.3fr_1fr_70px_56px_80px] gap-2 md:items-center">
                    {/* 排序 */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0 || r.fixed} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1 || r.fixed} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                        <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>

                    {/* 名称 */}
                    <div className="flex items-center gap-1.5">
                      <input
                        className={inp}
                        value={r.label}
                        onChange={(e) => patch(r.id, 'label', e.target.value)}
                        disabled={r.fixed}
                        placeholder="服务名称，如：学费查询"
                      />
                      {r.fixed && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="固定项" />}
                    </div>

                    {/* 图标 */}
                    <div className="flex items-center gap-1.5">
                      <input
                        className={`${inp} flex-1 min-w-0`}
                        list="icon-options"
                        value={r.icon || ''}
                        onChange={(e) => patch(r.id, 'icon', e.target.value)}
                        disabled={r.fixed}
                        placeholder="图标名"
                      />
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <ServiceIcon name={r.icon || 'Sparkles'} className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>

                    {/* 排序号 */}
                    <input
                      className={inp}
                      type="number"
                      value={r.sort_order ?? 0}
                      onChange={(e) => patch(r.id, 'sort_order', Number(e.target.value) || 0)}
                      disabled={r.fixed}
                      title="排序号（越小越靠前）"
                    />

                    {/* 显示/隐藏 */}
                    <button
                      onClick={() => patch(r.id, 'enabled', !r.enabled)}
                      disabled={r.fixed}
                      className="h-9 rounded-lg bg-gray-50 flex items-center justify-center disabled:opacity-40"
                      title={r.fixed ? '固定项不可隐藏' : r.enabled ? '点击隐藏' : '点击显示'}
                    >
                      {r.enabled ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </button>

                    {/* 删除 */}
                    <button
                      onClick={() => removeRow(r)}
                      disabled={r.fixed}
                      className="h-9 rounded-lg bg-red-50 text-red-500 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <datalist id="icon-options">
          {ICON_KEYS.slice(0, 80).map((k) => <option key={k} value={k} />)}
        </datalist>

        <DialogFooter>
          <button onClick={onClose} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">关闭</button>
          <button onClick={saveAll} disabled={saving} className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 批量保存（{rows.length} 项）
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
