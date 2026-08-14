import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, Upload, Download, ExternalLink, Trash2, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/adminapi';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface UniGridDialogProps {
  university: any;
  open: boolean;
  onClose: () => void;
}

/**
 * 九宫格内容编辑弹窗（v17）
 * - 每个学校独立编辑九宫格文字内容 + 网盘链接
 * - 批量导入：粘贴「服务项标签|内容|网盘链接」每行一条
 * - 导出该校内容文本、批量清空
 */
export default function UniGridDialog({ university, open, onClose }: UniGridDialogProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');

  useEffect(() => {
    if (!open || !university) return;
    setLoading(true);
    adminApi.listServiceContentsForUni(university.id, 'university')
      .then((list: any[]) => setRows(list || []))
      .catch(() => toast.error('加载九宫格内容失败'))
      .finally(() => setLoading(false));
    setBatchText('');
    setBatchOpen(false);
  }, [open, university?.id]);

  const updateRow = (idx: number, patch: any) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // 保存全部（逐条 upsert，九宫格固定 9 项以内）
  const saveAll = async () => {
    setSaving(true);
    let ok = 0;
    try {
      for (const r of rows) {
        await adminApi.saveServiceContent(university.id, r.service.id, r.content || '', r.netdiskUrl || '', !!r.adUnlock);
        ok++;
      }
      toast.success(`已保存 ${ok} 项内容`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 批量导入：每行「服务项标签|内容|网盘链接」
  const batchImport = async () => {
    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error('没有解析到数据'); return; }
    let matched = 0;
    const next = [...rows];
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      const label = parts[0];
      const content = parts[1] || '';
      const netdisk = parts[2] || '';
      const idx = next.findIndex((r) => r.service.label === label);
      if (idx >= 0) {
        next[idx] = { ...next[idx], content, netdiskUrl: netdisk };
        matched++;
      }
    }
    if (matched === 0) { toast.error('未匹配到任何服务项，请确认「服务项标签|内容|网盘链接」格式'); return; }
    setRows(next);
    setBatchOpen(false);
    setBatchText('');
    toast.success(`已匹配 ${matched} 项，点击「保存全部」生效`);
  };

  // 导出该校内容
  const exportUni = () => {
    const text = rows.map((r) => `${r.service.label}|${r.content || ''}|${r.netdiskUrl || ''}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${university?.name || 'school'}-九宫格内容.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('已导出该校九宫格内容');
  };

  // 批量清空该校内容
  const clearAll = async () => {
    if (!window.confirm(`确定清空「${university?.name}」全部九宫格内容？`)) return;
    setSaving(true);
    try {
      for (const r of rows) {
        await adminApi.saveServiceContent(university.id, r.service.id, '', '');
      }
      setRows((prev) => prev.map((r) => ({ ...r, content: '', netdiskUrl: '' })));
      toast.success('已清空');
    } catch (e: any) {
      toast.error(e?.message || '清空失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-blue-500" />
            九宫格内容 · {university?.name || ''}
          </DialogTitle>
          <DialogDescription>
            每个服务项的展示文字与网盘链接均按学校独立配置；修改后点击「保存全部」生效。
          </DialogDescription>
        </DialogHeader>

        {/* 批量工具条 */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBatchOpen((v) => !v)} className="h-8 px-3 rounded-full bg-violet-50 text-violet-600 text-xs font-medium border border-violet-200 flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" /> 批量导入
          </button>
          <button onClick={exportUni} className="h-8 px-3 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> 导出该校
          </button>
          <button onClick={clearAll} disabled={saving} className="h-8 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium border border-red-100 flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> 清空
          </button>
          <button
            onClick={() => { onClose(); navigate(`/admin/uni-content/${university?.id}`); }}
            className="h-8 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center gap-1 ml-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" /> 打开完整编辑页
          </button>
        </div>

        {batchOpen && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
            <div className="text-[11px] text-violet-600 mb-2">
              每行一条：<b>服务项标签|展示文字|网盘链接</b>（标签需与九宫格服务项名称一致，如「复习资料」）
            </div>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={4}
              placeholder={'复习资料|历年真题整理版|https://pan.quark.cn/xxxx\n导师攻略|各院系导师评价|https://pan.quark.cn/yyyy'}
              className="w-full rounded-lg border border-gray-200 text-xs p-2.5 outline-none focus:border-violet-300 font-mono"
            />
            <button onClick={batchImport} className="mt-2 h-8 px-4 rounded-full bg-violet-600 text-white text-xs font-medium">
              匹配并填入
            </button>
          </div>
        )}

        {/* 九宫格内容列表 */}
        <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">该专题暂无服务项，请先在「九宫格配置」中添加</div>
          ) : (
            rows.map((r, idx) => (
              <div key={r.service.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700">{r.service.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">icon: {r.service.icon}</span>
                </div>
                <textarea
                  value={r.content || ''}
                  onChange={(e) => updateRow(idx, { content: e.target.value })}
                  rows={2}
                  placeholder="九宫格下方的展示文字（支持换行）"
                  className="w-full rounded-lg border border-gray-200 bg-white text-sm p-2.5 outline-none focus:border-blue-300 resize-none"
                />
                <input
                  value={r.netdiskUrl || ''}
                  onChange={(e) => updateRow(idx, { netdiskUrl: e.target.value })}
                  placeholder="网盘链接（解锁后可见）"
                  className="mt-1.5 w-full h-9 rounded-lg border border-gray-200 bg-white text-xs px-2.5 outline-none focus:border-blue-300"
                />
                {/* v27：每校独立广告开关 */}
                <div className="mt-1.5 flex items-center justify-between rounded-lg bg-orange-50/60 border border-orange-100 px-3 py-2">
                  <span className="text-[11px] text-gray-600">需要看广告解锁</span>
                  <button
                    onClick={() => updateRow(idx, { adUnlock: !r.adUnlock })}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${r.adUnlock ? 'bg-orange-500' : 'bg-gray-200'}`}
                    aria-pressed={!!r.adUnlock}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.adUnlock ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
            取消
          </button>
          <button onClick={saveAll} disabled={saving || loading} className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40 flex items-center gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 保存全部
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
