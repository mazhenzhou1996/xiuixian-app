import { useState, useEffect } from 'react';
import { Search, Loader2, EyeOff, Eye, Trash2, FileText } from 'lucide-react';
import { adminApi } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';

type Type = 'question' | 'answer' | 'comment';

export default function AdminContentPage() {
  const [type, setType] = useState<Type>('question');
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (t: Type, kw?: string) => {
    setLoading(true);
    try {
      if (t === 'comment') {
        setList(await adminApi.listComments(kw?.trim() || undefined));
      } else {
        setList(await adminApi.listContent(t, kw?.trim() || undefined));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(type); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type]);

  const handleToggle = async (item: any) => {
    const next = item.status === 'active' ? 'hidden' : 'active';
    setBusyId(String(item.id));
    try {
      await adminApi.setContentStatus(type, item.id, next);
      toast.success(next === 'hidden' ? '已下架（前台不可见）' : '已恢复上架');
      load(type);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`确认删除该${type === 'question' ? '问题' : type === 'answer' ? '回答' : '评论'}（ID ${item.id}）？将级联删除关联数据，不可恢复。`)) return;
    setBusyId(String(item.id));
    try {
      await adminApi.adminDeleteContent(type, item.id);
      // 量化系统：内容被删除自动扣分（评论 -5，问题/回答 -10）
      if (item.userId) {
        try {
          const res = await adminApi.deductCredit(item.userId, type === 'comment' ? -5 : -10, `内容被管理员删除（${type} #${item.id}）`);
          if (res?.action && res.action !== 'none') {
            const t = res.action === 'ban_7d' ? '自动封禁 7 天' : res.action === 'mute_7d' ? '自动禁言 7 天' : '自动禁言 1 天';
            toast.info(`量化系统：该作者信誉分 ${res.credit}，${t}`);
          }
        } catch { /* ignore */ }
      }
      toast.success('已删除');
      load(type);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* 类型 Tab */}
      <div className="bg-white rounded-xl p-1 flex">
        {(['question', 'answer', 'comment'] as Type[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${type === t ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            {t === 'question' ? '问题' : t === 'answer' ? '回答' : '评论'}
          </button>
        ))}
      </div>

      {/* 搜索 */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-full px-3 h-10 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(type, keyword)}
            placeholder={type === 'question' ? '搜索标题 / 内容' : '搜索内容'}
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <button onClick={() => load(type, keyword)} className="h-10 px-4 rounded-full bg-blue-600 text-white text-xs font-medium">
          搜索
        </button>
      </div>

      {loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">暂无内容</p>
        </div>
      )}

      {/* 内容列表 */}
      <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden">
        {list.map((item) => (
          <div key={item.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {item.title && <div className="text-sm text-gray-800 font-medium line-clamp-1">{item.title}</div>}
                <div className={`text-xs text-gray-600 line-clamp-2 ${item.title ? 'mt-1' : ''}`}>{item.content}</div>
                <div className="text-[11px] text-gray-400 mt-1.5">
                  {item.authorName || '匿名'} · {formatTime(item.createdAt)}
                  {item.questionId ? ` · 所属问题 #${item.questionId}` : ''}
                  <span className="mx-1">·</span>ID #{item.id}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <span className={`self-end text-[10px] px-2 py-0.5 rounded-full border ${
                  item.status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {item.status === 'active' ? '正常' : '已下架'}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleToggle(item)}
                    disabled={busyId === String(item.id)}
                    className={`h-8 px-3 rounded-full text-xs font-medium disabled:opacity-40 flex items-center gap-1 ${
                      item.status === 'active' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {item.status === 'active' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {item.status === 'active' ? '下架' : '恢复'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={busyId === String(item.id)}
                    className="h-8 px-3 rounded-full bg-red-50 text-red-500 text-xs font-medium disabled:opacity-40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
