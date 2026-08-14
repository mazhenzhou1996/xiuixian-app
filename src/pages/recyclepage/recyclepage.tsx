import { useState, useEffect } from 'react';
import { Loader2, RotateCcw, FileQuestion, Trophy } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function RecyclePage() {
  usePageTitle('回收箱');
  const [tab, setTab] = useState<'questions' | 'bounties'>('questions');
  const [questions, setQuestions] = useState<any[]>([]);
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [q, b] = await Promise.all([api.getMyTrashedQuestions(), api.getMyTrashedBounties()]);
      setQuestions(q);
      setBounties(b);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const restoreQuestion = async (q: any) => {
    setBusy('q' + q.id);
    try {
      await api.restoreQuestion(q.id);
      toast.success('问题已恢复');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const restoreBounty = async (b: any) => {
    setBusy('b' + b.id);
    try {
      await api.restoreBounty(b.id);
      toast.success('悬赏已恢复');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="回收箱" />

      <div className="px-4 py-3 space-y-3">
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-600">
          删除的内容保留 15 天，可随时恢复；超过 15 天将自动彻底删除。
        </div>

        {/* Tab */}
        <div className="bg-white rounded-xl p-1 flex">
          {([
            { key: 'questions', label: `问题（${questions.length}）` },
            { key: 'bounties', label: `悬赏（${bounties.length}）` },
          ] as { key: 'questions' | 'bounties'; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
          </div>
        ) : tab === 'questions' ? (
          questions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <FileQuestion className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">回收箱暂无问题</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden">
              {questions.map((q) => (
                <div key={q.id} className="p-4">
                  <div className="text-sm text-gray-800 font-medium line-clamp-1 mb-1">{q.title}</div>
                  <div className="text-[11px] text-gray-400 mb-2.5">删除时间：{formatTime(q.deleted_at || q.createdAt)}</div>
                  <button
                    onClick={() => restoreQuestion(q)}
                    disabled={busy === 'q' + q.id}
                    className="h-8 px-4 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 disabled:opacity-40 flex items-center gap-1"
                  >
                    {busy === 'q' + q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} 恢复
                  </button>
                </div>
              ))}
            </div>
          )
        ) : bounties.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">回收箱暂无悬赏</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden">
            {bounties.map((b) => (
              <div key={b.id} className="p-4">
                <div className="text-sm text-gray-800 font-medium line-clamp-1 mb-1">{b.title}</div>
                <div className="text-[11px] text-gray-400 mb-2.5">
                  悬赏 ¥{b.totalAmount} · 删除时间：{formatTime(new Date(b.deletedAt).getTime())}
                </div>
                <button
                  onClick={() => restoreBounty(b)}
                  disabled={busy === 'b' + b.id}
                  className="h-8 px-4 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 disabled:opacity-40 flex items-center gap-1"
                >
                  {busy === 'b' + b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} 恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
