import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Megaphone } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const EMPTY = { id: 0, title: '', content: '', enabled: true };

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setList(await adminApi.listAnnouncements());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!edit?.title?.trim()) { toast.error('请输入公告标题'); return; }
    if (!edit?.content?.trim()) { toast.error('请输入公告内容'); return; }
    setSaving(true);
    try {
      await adminApi.saveAnnouncement(edit, !edit.id);
      toast.success('公告已保存');
      setEdit(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: any) => {
    if (!window.confirm(`确认删除公告「${a.title}」？`)) return;
    try {
      await adminApi.deleteAnnouncement(a.id);
      toast.success('已删除');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (a: any) => {
    try {
      await adminApi.toggleAnnouncement(a.id, !a.enabled);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 text-xs text-gray-500 leading-relaxed">
        公告发布后显示在所有用户的消息中心「官方消息」中，可随时停用或删除。
      </div>

      <button
        onClick={() => setEdit({ ...EMPTY })}
        className="w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" /> 发布新公告
      </button>

      {loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden">
        {!loading && list.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">还没有公告</p>
          </div>
        )}
        {list.map((a) => (
          <div key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${a.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{a.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${a.enabled ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                    {a.enabled ? '展示中' : '已停用'}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1 whitespace-pre-line line-clamp-2">{a.content}</div>
                <div className="text-[11px] text-gray-400 mt-1.5">
                  {a.authorName || '管理员'} 发布 · {formatTime(a.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => handleToggle(a)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title={a.enabled ? '停用' : '启用'}>
                  {a.enabled ? <Eye className="w-4 h-4 text-gray-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => setEdit({ ...a })} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title="编辑">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => handleDelete(a)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center" title="删除">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑弹窗 */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? '编辑公告' : '发布公告'}</DialogTitle>
            <DialogDescription>保存后立即对全站用户可见（消息中心 → 官方消息）</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-2.5">
              <div>
                <div className="text-xs text-gray-500 mb-1">标题 *</div>
                <input
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-300"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  placeholder="如：欢迎来到修仙问答"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">内容 *</div>
                <textarea
                  className="w-full h-28 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-blue-300"
                  value={edit.content}
                  onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                  placeholder="公告正文，支持换行"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={edit.enabled}
                  onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                立即发布（展示给用户）
              </label>
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
    </div>
  );
}
