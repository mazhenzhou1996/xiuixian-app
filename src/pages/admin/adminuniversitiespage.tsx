import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Upload, Download, Loader2, Pencil, Trash2, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import UniGridDialog from '@/components/unigriddialog';
import ServiceConfigDialog from '@/components/serviceconfigdialog';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const LEVEL_LABEL: Record<string, string> = {
  '985': '985',
  '211': '211',
  double_first_class: '双一流',
  provincial: '省属重点',
  other: '其他',
};

const EMPTY = {
  id: 0, name: '', province: '', city: '', level: 'other', tags: [] as string[],
  qs: '', address: '', intro: '', pay_text: '付费咨询学长学姐', hot_label: '本校热门',
  sort_order: 0, enabled: true,
};

export default function AdminUniversitiesPage() {
  const [list, setList] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // v17：九宫格内容编辑弹窗
  const [gridUni, setGridUni] = useState<any | null>(null);
  // v18：九宫格功能配置弹窗（排序/图标/广告解锁/显隐）
  const [serviceCfgOpen, setServiceCfgOpen] = useState(false);

  const load = async (kw?: string) => {
    setLoading(true);
    try {
      setList(await adminApi.listUniversities(kw));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doSearch = () => load(keyword.trim() || undefined);

  const openNew = () => setEdit({ ...EMPTY });
  const openEdit = (u: any) => setEdit({ ...u, tags: [...(u.tags || [])] });

  const handleSave = async () => {
    if (!edit?.name?.trim()) { toast.error('请输入学校名称'); return; }
    setSaving(true);
    try {
      await adminApi.saveUniversity(edit, !edit.id);
      toast.success('保存成功');
      setEdit(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: any) => {
    try {
      await adminApi.toggleUniversity(u.id, !u.enabled);
      toast.success(u.enabled ? '已停用' : '已启用');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (u: any) => {
    if (!window.confirm(`确认删除「${u.name}」？可在变更回滚中恢复。`)) return;
    try {
      await adminApi.deleteUniversity(u.id);
      toast.success('已删除（可在变更回滚中恢复）');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // 批量导入
  const parseImport = (text: string): any[] => {
    const t = text.trim();
    if (!t) return [];
    try {
      const arr = JSON.parse(t);
      return Array.isArray(arr) ? arr : [arr];
    } catch {
      // 尝试 CSV：name,province,city,level,tags(qs/address/intro 可省略)
      const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows: any[] = [];
      for (const line of lines) {
        const cols = line.split(/[,，]/).map((c) => c.trim());
        if (!cols[0]) continue;
        rows.push({
          name: cols[0],
          province: cols[1] || '',
          city: cols[2] || '',
          level: cols[3] || 'other',
          tags: cols[4] ? cols[4].split(/[\/|]/).map((s) => s.trim()).filter(Boolean) : [],
          qs: cols[5] || '',
          address: cols[6] || '',
        });
      }
      return rows;
    }
  };

  const handleImport = async () => {
    const rows = parseImport(importText);
    if (rows.length === 0) { toast.error('没有解析到数据'); return; }
    setImporting(true);
    try {
      const res = await adminApi.importUniversities(rows);
      toast.success(`导入完成：新增 ${res.added}，更新 ${res.updated}，失败 ${res.failed}`);
      if (res.errors.length > 0) {
        console.warn('导入失败明细', res.errors.slice(0, 10));
      }
      setImportOpen(false);
      setImportText('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ''));
      toast.info(`已读取 ${f.name}`);
    };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const tpl = [
      { name: '示例大学', province: '省份', city: '城市', level: 'other', tags: ['标签1', '标签2'], qs: '', address: '地址', intro: '简介', pay_text: '付费咨询学长学姐', hot_label: '本校热门', sort_order: 0, enabled: true },
    ];
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'universities-import-template.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-full px-3 h-10 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索学校 / 省份 / 城市"
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <button onClick={openNew} className="h-10 px-3.5 rounded-full bg-blue-600 text-white text-xs font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" /> 新增
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setServiceCfgOpen(true)} className="flex-1 h-9 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200 flex items-center justify-center gap-1">
          <LayoutGrid className="w-3.5 h-3.5" /> 九宫格功能配置（排序/图标/广告/显隐）
        </button>
        <button onClick={() => setImportOpen(true)} className="flex-1 h-9 rounded-full bg-violet-50 text-violet-600 text-xs font-medium border border-violet-200 flex items-center justify-center gap-1">
          <Upload className="w-3.5 h-3.5" /> 批量导入（JSON/CSV）
        </button>
        <button onClick={downloadTemplate} className="flex-1 h-9 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center gap-1">
          <Download className="w-3.5 h-3.5" /> 下载模板
        </button>
      </div>

      <div className="text-[11px] text-gray-400 px-1">
        共 {list.length} 所 · 内置种子含 985 全部 39 所、211 全部 61 所、双一流及各省重点约 370 所；其余本科院校用教育部名单导入
      </div>

      {loading && list.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {/* 列表 */}
      {!loading && list.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">没有匹配的学校</div>
      )}

      <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
        {list.map((u) => (
          <div key={u.id} className={`p-3.5 ${u.enabled ? '' : 'opacity-50'}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{u.name}</span>
                  {u.level && u.level !== 'other' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                      {LEVEL_LABEL[u.level] || u.level}
                    </span>
                  )}
                  {(u.tags || []).slice(0, 3).map((t: string) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-100">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {[u.province, u.city].filter(Boolean).join(' · ') || '—'}
                  {u.qs && ` · ${u.qs}`}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setGridUni(u)} className="h-8 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center gap-1" title="编辑该校九宫格内容（文字+网盘链接，批量导入导出）">
                  <LayoutGrid className="w-3.5 h-3.5" /> 九宫格
                </button>
                <button onClick={() => handleToggle(u)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title={u.enabled ? '停用' : '启用'}>
                  {u.enabled ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => openEdit(u)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title="编辑">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => handleDelete(u)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title="删除">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑/新增弹窗 */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? '编辑高校' : '新增高校'}</DialogTitle>
            <DialogDescription>带 * 为必填；保存后自动记录变更，可在「变更回滚」恢复</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              <Field label="学校名称 *">
                <input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="如：清华大学" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="省份">
                  <input className="inp" value={edit.province} onChange={(e) => setEdit({ ...edit, province: e.target.value })} placeholder="如：北京" />
                </Field>
                <Field label="城市">
                  <input className="inp" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} placeholder="如：北京" />
                </Field>
              </div>
              <Field label="层次">
                <select className="inp" value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>
                  <option value="985">985</option>
                  <option value="211">211</option>
                  <option value="double_first_class">双一流</option>
                  <option value="provincial">省属重点</option>
                  <option value="other">其他</option>
                </select>
              </Field>
              <Field label="标签（逗号分隔）">
                <input className="inp" value={(edit.tags || []).join(',')} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) })} placeholder="985,211,双一流" />
              </Field>
              <Field label="QS 排名">
                <input className="inp" value={edit.qs} onChange={(e) => setEdit({ ...edit, qs: e.target.value })} placeholder="如：QS 世界排名 前20" />
              </Field>
              <Field label="地址">
                <input className="inp" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="详细地址" />
              </Field>
              <Field label="简介">
                <textarea className="inp" rows={2} value={edit.intro} onChange={(e) => setEdit({ ...edit, intro: e.target.value })} placeholder="学校简介" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="付费咨询文案">
                  <input className="inp" value={edit.pay_text} onChange={(e) => setEdit({ ...edit, pay_text: e.target.value })} />
                </Field>
                <Field label="本校热门标签">
                  <input className="inp" value={edit.hot_label} onChange={(e) => setEdit({ ...edit, hot_label: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="排序">
                  <input className="inp" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="状态">
                  <select className="inp" value={edit.enabled ? '1' : '0'} onChange={(e) => setEdit({ ...edit, enabled: e.target.value === '1' })}>
                    <option value="1">启用</option>
                    <option value="0">停用</option>
                  </select>
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setEdit(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={handleSave} disabled={saving} className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入弹窗 */}
      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量导入高校</DialogTitle>
            <DialogDescription>支持 JSON 数组（推荐，字段全）或 CSV（name,province,city,level,tags）。名称已存在则更新，否则新增。</DialogDescription>
          </DialogHeader>
          <button onClick={() => fileRef.current?.click()} className="h-10 rounded-xl bg-violet-50 text-violet-600 text-xs font-medium border border-violet-200">
            选择 JSON/CSV 文件
          </button>
          <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={handleFile} className="hidden" />
          <textarea
            className="w-full h-36 rounded-xl border border-gray-200 text-xs p-3 outline-none focus:border-blue-300 font-mono"
            placeholder='或直接粘贴 JSON：[{"name":"XX大学","province":"XX","city":"XX","level":"other","tags":[]}]'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <DialogFooter>
            <button onClick={() => setImportOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button onClick={handleImport} disabled={importing} className="h-9 px-6 bg-violet-600 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1">
              {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} 开始导入
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 九宫格内容编辑弹窗（v17：每校独立配置 + 批量导入/导出） */}
      <UniGridDialog university={gridUni} open={!!gridUni} onClose={() => setGridUni(null)} />

      {/* 九宫格功能配置弹窗（v18：排序/图标/广告解锁/显隐，付费咨询固定项） */}
      <ServiceConfigDialog open={serviceCfgOpen} onClose={() => setServiceCfgOpen(false)} />

      <style>{`.inp{width:100%;height:38px;border-radius:10px;border:1px solid #e5e7eb;padding:0 12px;font-size:13px;outline:none;background:#fff}.inp:focus{border-color:#93c5fd}.inp[rows]{height:auto;padding:8px 12px}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}
