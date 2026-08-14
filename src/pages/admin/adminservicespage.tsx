import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Eye, EyeOff, Save, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { ServiceIcon, ICON_KEYS } from '@/lib/iconmap';
import { toast } from 'sonner';

const TOPICS = [
  { key: 'university', label: '大学专题' },
  { key: 'graduate', label: '研究生专题' },
];

const EMPTY = { id: 0, topic: 'university', label: '', icon: 'Sparkles', url: '', description: '', ad_unlock: false, sort_order: 0, enabled: true };

export default function AdminServicesPage() {
  const [topic, setTopic] = useState('university');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any | null>(null);

  const load = async (t: string) => {
    setLoading(true);
    try {
      const [svc, cfg] = await Promise.all([adminApi.listServices(t), adminApi.getTopicConfig(t)]);
      setRows(svc);
      setConfig(cfg);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(topic); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [topic]);

  const patch = (id: number | null, field: string, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id || (id === null && r._new) ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    setRows((prev) => [...prev, { ...EMPTY, topic, sort_order: maxSort + 1, _new: true }]);
  };

  const removeRow = async (r: any) => {
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
      const t = next[idx + dir];
      if (!t) return prev;
      const cur = next[idx];
      const curSort = cur.sort_order;
      next[idx] = { ...t, sort_order: curSort };
      next[idx + dir] = { ...cur, sort_order: t.sort_order };
      return next;
    });
  };

  // 批量保存：全部行一次提交
  const saveAll = async () => {
    const invalid = rows.find((r) => !r.label.trim());
    if (invalid) { toast.error('有服务名称为空，请填写后再保存'); return; }
    setSaving(true);
    try {
      for (const r of rows) {
        await adminApi.saveService(
          { id: r.id, topic, label: r.label.trim(), icon: r.icon || 'Sparkles', url: r.url || '', description: r.description || '', ad_unlock: !!r.ad_unlock, sort_order: r.sort_order || 0, enabled: r.enabled !== false },
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

  const saveConfig = async () => {
    if (!config) return;
    try {
      await adminApi.saveTopicConfig({ ...config, topic });
      toast.success('专题配置已保存');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const inp = 'w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-blue-300 bg-white';

  return (
    <div className="space-y-3">
      {/* 专题切换 */}
      <div className="bg-white rounded-xl p-1 flex">
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

      {/* 专题配置 */}
      {config && (
        <div className="bg-white rounded-2xl p-4">
          <div className="text-xs font-medium text-gray-600 mb-2">专题配置（标题 / 热榜标签 / 咨询文案）</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={inp} value={config.title || ''} onChange={(e) => setConfig({ ...config, title: e.target.value })} placeholder="专题标题" />
            <input className={inp} value={config.hot_label || ''} onChange={(e) => setConfig({ ...config, hot_label: e.target.value })} placeholder="热榜标签" />
            <input className={inp} value={config.pay_text || ''} onChange={(e) => setConfig({ ...config, pay_text: e.target.value })} placeholder="咨询文案" />
          </div>
          <button onClick={saveConfig} className="mt-2.5 h-8 px-4 rounded-full bg-blue-600 text-white text-xs font-medium">
            保存专题配置
          </button>
        </div>
      )}

      {/* 批量编辑列表 */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
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

        {/* 表头（桌面） */}
        {rows.length > 0 && (
          <div className="hidden md:grid grid-cols-[40px_1.4fr_1fr_0.7fr_1.2fr_60px_60px_90px] gap-2 px-4 py-2 bg-gray-50 text-[11px] text-gray-400 font-medium">
            <span>排序</span><span>名称 *</span><span>图标</span><span>排序号</span><span>链接（网盘/页面）</span><span>广告解锁</span><span>启用</span><span>操作</span>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {rows.map((r, idx) => (
            <div key={r.id || `new-${idx}`} className={`px-4 py-3 ${r.enabled ? '' : 'opacity-60'}`}>
              <div className="grid grid-cols-1 md:grid-cols-[40px_1.4fr_1fr_0.7fr_1.2fr_60px_60px_90px] gap-2 md:items-center">
                {/* 移动端名称 */}
                <div className="md:hidden flex items-center gap-2 mb-1.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                    <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                    <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                </div>

                {/* 排序（桌面） */}
                <div className="hidden md:flex items-center gap-1">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                    <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center disabled:opacity-30">
                    <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>

                {/* 名称：内联编辑 */}
                <input
                  className={inp}
                  value={r.label}
                  onChange={(e) => patch(r.id, 'label', e.target.value)}
                  placeholder="服务名称，如：学费查询"
                />

                {/* 图标：输入 + 预览 */}
                <div className="flex items-center gap-1.5">
                  <input
                    className={`${inp} flex-1 min-w-0`}
                    list="icon-options"
                    value={r.icon || ''}
                    onChange={(e) => patch(r.id, 'icon', e.target.value)}
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
                />

                {/* 链接 */}
                <div className="flex items-center gap-1.5">
                  <input
                    className={`${inp} flex-1 min-w-0`}
                    value={r.url || ''}
                    onChange={(e) => patch(r.id, 'url', e.target.value)}
                    placeholder="https://网盘链接 或 /站内路径"
                  />
                  {r.url && <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                </div>

                {/* 广告解锁 */}
                <button
                  onClick={() => patch(r.id, 'ad_unlock', !r.ad_unlock)}
                  className={`h-9 rounded-lg text-xs font-medium border transition-colors ${r.ad_unlock ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-400 border-gray-200'}`}
                  title="开启后：用户需观看广告才能打开该链接"
                >
                  {r.ad_unlock ? '看广告' : '直接打开'}
                </button>

                {/* 启用 */}
                <button
                  onClick={() => patch(r.id, 'enabled', !r.enabled)}
                  className="h-9 rounded-lg bg-gray-50 flex items-center justify-center"
                >
                  {r.enabled ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                </button>

                {/* 操作 */}
                <div className="flex gap-1.5">
                  <button onClick={() => removeRow(r)} className="flex-1 md:flex-none h-9 px-3 rounded-lg bg-red-50 text-red-500 text-xs font-medium flex items-center justify-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 批量保存 */}
      <div className="sticky bottom-4">
        <button
          onClick={saveAll}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          批量保存全部修改（{rows.length} 项）
        </button>
      </div>

      <datalist id="icon-options">
        {ICON_KEYS.slice(0, 80).map((k) => <option key={k} value={k} />)}
      </datalist>

      <div className="text-[11px] text-gray-400 px-1 leading-relaxed">
        💡 批量编辑：直接在列表里改文字，一次「批量保存」全部生效，不用逐个打开。链接可填网盘链接或站内路径；开启「看广告」后，用户需观看广告才能打开该链接（广告位配置见 README 广告接入章节）。
      </div>
    </div>
  );
}
