import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Loader2, Upload, Download, ArrowLeft, School, Shield } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { adminApi } from '@/lib/adminapi';
import { ServiceIcon } from '@/lib/iconmap';
import { toast } from 'sonner';

export default function AdminUniContentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uni, setUni] = useState<any | null>(null);
  const [topic, setTopic] = useState('university');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const ok = await adminApi.checkAdmin();
      setIsAdmin(ok);
      setChecked(true);
    })();
  }, []);

  const load = async (t: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [uniData, list] = await Promise.all([
        adminApi.getUniversityById(Number(id)),
        adminApi.listServiceContentsForUni(Number(id), t),
      ]);
      setUni(uniData);
      setRows(list);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && id) load(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id, topic]);

  const patch = (serviceId: number, field: 'content' | 'netdiskUrl', value: string) => {
    setRows((prev) => prev.map((r) => (r.service.id === serviceId ? { ...r, [field]: value } : r)));
  };

  const saveRow = async (r: any) => {
    if (!id) return;
    setSavingKey(String(r.service.id));
    try {
      await adminApi.saveServiceContent(Number(id), r.service.id, r.content, r.netdiskUrl);
      toast.success(`「${r.service.label}」已保存`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const saveAll = async () => {
    if (!id) return;
    setSavingKey('all');
    try {
      for (const r of rows) {
        await adminApi.saveServiceContent(Number(id), r.service.id, r.content, r.netdiskUrl);
      }
      toast.success(`已保存全部 ${rows.length} 项`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  // ---- 批量导入 ----
  const parseImport = (text: string): any[] => {
    const t = text.trim();
    if (!t) return [];
    try {
      const arr = JSON.parse(t);
      return Array.isArray(arr) ? arr : [arr];
    } catch {
      // CSV: university,topic,service,content,netdisk_url
      const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows: any[] = [];
      for (const line of lines) {
        const cols = line.split(',').map((c) => c.trim());
        if (!cols[0] || !cols[2]) continue;
        rows.push({ university: cols[0], topic: cols[1] || 'university', service: cols[2], content: cols[3] || '', netdisk_url: cols[4] || '' });
      }
      return rows;
    }
  };

  const handleImport = async () => {
    const rowsData = parseImport(importText);
    if (rowsData.length === 0) { toast.error('没有解析到数据'); return; }
    setImporting(true);
    try {
      const res = await adminApi.bulkImportContents(rowsData);
      toast.success(`导入完成：新增 ${res.added}，更新 ${res.updated}，失败 ${res.failed}`);
      if (res.failed > 0) console.warn('导入失败明细', res.errors);
      setImportOpen(false);
      setImportText('');
      load(topic);
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
      { university: uni?.name || '示例大学', topic: 'university', service: '学霸笔记', content: '这里填写文字内容...', netdisk_url: 'https://pan.baidu.com/s/xxxx' },
      { university: uni?.name || '示例大学', topic: 'university', service: '考试真题', content: '', netdisk_url: '' },
    ];
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'service-contents-template.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportAll = async () => {
    try {
      const all = await adminApi.exportAllContents();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'service-contents-all.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`已导出 ${all.length} 条内容（可在 Excel/编辑器中批量修改后导回）`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!checked) {
    return <div className="min-h-screen bg-gray-50"><PageHeader title="内容管理" /><div className="text-center py-20 text-gray-400 text-sm">权限校验中...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="内容管理" />
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Shield className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">无权访问</p>
        </div>
      </div>
    );
  }

  const inp = 'w-full h-10 rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-blue-300 bg-white';
  const ta = 'w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-300 bg-white leading-relaxed';

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="max-w-4xl mx-auto p-4">
        {/* 页头 */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/admin?tab=universities')} className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate flex items-center gap-2">
              <School className="w-5 h-5 text-blue-600 shrink-0" />
              {uni?.name || '高校内容管理'}
            </h1>
            <p className="text-xs text-gray-400">每所高校的每个九宫格服务独立编辑文字与网盘附件</p>
          </div>
        </div>

        {/* 批量操作 */}
        <div className="bg-white rounded-2xl p-3 mb-3 flex gap-2 flex-wrap">
          <button onClick={downloadTemplate} className="flex-1 min-w-[110px] h-9 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center gap-1">
            <Download className="w-3.5 h-3.5" /> 下载模板
          </button>
          <button onClick={exportAll} className="flex-1 min-w-[110px] h-9 rounded-full bg-blue-50 text-blue-600 text-xs font-medium flex items-center justify-center gap-1">
            <Download className="w-3.5 h-3.5" /> 导出全部内容
          </button>
          <button onClick={() => setImportOpen(true)} className="flex-1 min-w-[110px] h-9 rounded-full bg-violet-50 text-violet-600 text-xs font-medium flex items-center justify-center gap-1">
            <Upload className="w-3.5 h-3.5" /> 批量导入
          </button>
        </div>

        {/* Topic 切换 */}
        <div className="bg-white rounded-xl p-1 flex mb-3">
          {(['university', 'graduate'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${topic === t ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              {t === 'university' ? '大学专题服务' : '研究生专题服务'}
            </button>
          ))}
        </div>

        {/* 服务内容列表 */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.service.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <ServiceIcon name={r.service.icon || 'Sparkles'} className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{r.service.label}</span>
                  <button
                    onClick={() => saveRow(r)}
                    disabled={savingKey === String(r.service.id)}
                    className="ml-auto h-8 px-4 rounded-full bg-blue-600 text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1"
                  >
                    {savingKey === String(r.service.id) && <Loader2 className="w-3 h-3 animate-spin" />}
                    保存本项
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">文字内容（前台点击该服务后显示）</div>
                    <textarea
                      className={`${ta} min-h-[72px]`}
                      placeholder="输入文字信息，支持换行..."
                      value={r.content}
                      onChange={(e) => patch(r.service.id, 'content', e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">网盘附件链接（用户观看广告后解锁打开）</div>
                    <input
                      className={inp}
                      placeholder="https://pan.baidu.com/s/xxxx 或 https://pan.quark.cn/..."
                      value={r.netdiskUrl}
                      onChange={(e) => patch(r.service.id, 'netdiskUrl', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={saveAll}
              disabled={savingKey === 'all'}
              className="w-full h-12 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingKey === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存全部（{rows.length} 项）
            </button>
          </div>
        )}
      </div>

      {/* 批量导入弹窗 */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">批量导入内容</h3>
            <p className="text-xs text-gray-400 mb-3">支持 JSON（推荐）或 CSV：university,topic,service,content,netdisk_url；按"高校名+服务名"自动匹配</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-10 rounded-xl bg-violet-50 text-violet-600 text-xs font-medium border border-violet-200 mb-2"
            >
              选择 JSON/CSV 文件
            </button>
            <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleFile} className="hidden" />
            <textarea
              className="w-full h-36 rounded-xl border border-gray-200 text-xs p-3 outline-none focus:border-violet-300 font-mono"
              placeholder='[{"university":"清华大学","topic":"university","service":"学霸笔记","content":"...","netdisk_url":"https://..."}]'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setImportOpen(false)} className="flex-1 h-10 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 h-10 rounded-full bg-violet-600 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                开始导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
