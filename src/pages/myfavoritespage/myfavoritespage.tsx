import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { FolderPlus, FolderOpen, MoveRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function MyFavoritesPage() {
  usePageTitle('我的收藏');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [items, setItems] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('全部');
  const [moveTarget, setMoveTarget] = useState<any>(null);
  const [newFolder, setNewFolder] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    store.getMyFavoritesWithFolder().then((list: any[]) => {
      setItems(list || []);
      const fs = [...new Set((list || []).map((x: any) => x.folder))];
      setFolders(fs);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的收藏" />
        <div className="text-center py-20 text-gray-400 text-sm">
          登录后查看我的收藏
        </div>
      </div>
    );
  }

  const filtered = activeFolder === '全部' ? items : items.filter((x: any) => x.folder === activeFolder);

  const moveTo = async (folder: string) => {
    if (!moveTarget) return;
    const target = folder.trim() || '默认收藏';
    try {
      await store.moveFavorite(Number(moveTarget.id), target);
      toast.success(`已移动到「${target}」`);
      setItems((prev) => prev.map((x: any) => (x.id === moveTarget.id ? { ...x, folder: target } : x)));
      if (!folders.includes(target)) setFolders((prev) => [...prev, target]);
      setMoveTarget(null);
      setNewFolder('');
    } catch (e: any) {
      toast.error(e?.message || '移动失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="我的收藏" />

      {/* 收藏夹筛选 */}
      {items.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['全部', ...folders].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFolder(f)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFolder === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {f}
              <span className="opacity-70">
                {f === '全部' ? items.length : items.filter((x: any) => x.folder === f).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          还没有收藏，遇到好问题点右下角收藏吧
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">该收藏夹暂无内容</div>
      ) : (
        <div className="mt-3 bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
          {filtered.map((q) => (
            <div key={q.id} className="relative">
              <QuestionCard question={q} />
              <button
                onClick={() => setMoveTarget(q)}
                className="absolute right-3 bottom-3 flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-full px-2 py-1 transition-colors"
              >
                <MoveRight className="w-3 h-3" />
                移动至 {q.folder}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 移动到文件夹 */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => { if (!o) { setMoveTarget(null); setNewFolder(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-blue-500" />
              移动到收藏夹
            </DialogTitle>
            <DialogDescription>{moveTarget?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => moveTo(f)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${moveTarget?.folder === f ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {f}
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="新建收藏夹名称"
                className="flex-1 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
              />
              <button
                onClick={() => moveTo(newFolder)}
                disabled={!newFolder.trim()}
                className="h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
              >
                新建并移动
              </button>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => { setMoveTarget(null); setNewFolder(''); }} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
              取消
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
