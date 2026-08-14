import { useState } from 'react';
import { Trash2, Send, Trophy, Coins } from 'lucide-react';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import QuestionCard from '@/components/QuestionCard';
import PageHeader from '@/components/PageHeader';
import InviteDialog from '@/components/invitedialog';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function MyQuestionsPage() {
  usePageTitle('我的提问');
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  // v19：悬赏邀请
  const [inviteQ, setInviteQ] = useState<any | null>(null);
  const [bountyQ, setBountyQ] = useState<any | null>(null);
  const [bountyAmount, setBountyAmount] = useState(10);
  const [bountyBusy, setBountyBusy] = useState(false);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的提问" />
        <div className="text-center py-20 text-gray-400 text-sm">请先登录</div>
      </div>
    );
  }

  const myQuestions = store.getQuestions().filter((q) => q.userId === currentUser.id);

  const handleDelete = async (q: any) => {
    if (!window.confirm('确认删除该问题？将进入回收箱，15 天内可恢复。')) return;
    try {
      await api.deleteQuestionSoft(q.id);
      toast.success('已删除（回收箱可恢复）');
      await store.refreshQuestions();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  };

  const confirmBounty = async () => {
    if (!bountyQ) return;
    if (!bountyAmount || bountyAmount <= 0 || bountyAmount > 100) {
      toast.error('悬赏金额 1-100 元');
      return;
    }
    setBountyBusy(true);
    try {
      await api.createBountyForQuestion(Number(bountyQ.id), bountyAmount);
      toast.success(`已挂悬赏 ¥${bountyAmount}，全网道友可接取`);
      setBountyQ(null);
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    } finally {
      setBountyBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="我的提问" />
      {myQuestions.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          还没有提问过，去提一个问题吧
        </div>
      ) : (
        <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
          {myQuestions.map((q) => (
            <div key={q.id} className="relative">
              <QuestionCard question={q} />
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                <button
                  onClick={() => setInviteQ(q)}
                  className="flex items-center gap-1 h-8 px-3 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium hover:bg-blue-100 transition-colors"
                  title="邀请回答（认证修士/指定用户/全网悬赏）"
                >
                  <Send className="w-3 h-3" /> 邀请回答
                </button>
                <button
                  onClick={() => setBountyQ(q)}
                  className="flex items-center gap-1 h-8 px-3 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium hover:bg-amber-100 transition-colors"
                  title="为问题挂悬赏"
                >
                  <Trophy className="w-3 h-3" /> 悬赏
                </button>
                <button
                  onClick={() => handleDelete(q)}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors"
                  title="删除（进回收箱）"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 邀请回答弹窗 */}
      <InviteDialog
        questionId={inviteQ?.id}
        questionSchoolId={inviteQ?.schoolId ?? null}
        open={!!inviteQ}
        onClose={() => setInviteQ(null)}
      />

      {/* 挂悬赏弹窗 */}
      <Dialog open={!!bountyQ} onOpenChange={(o) => !o && setBountyQ(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              为问题挂悬赏
            </DialogTitle>
            <DialogDescription>悬赏上榜后全网道友均可接取，最佳答案 70% 分红</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setBountyAmount(amt)}
                className={`h-10 rounded-xl text-sm font-bold border transition-colors ${bountyAmount === amt ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}
              >
                ¥{amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={bountyAmount || ''}
            onChange={(e) => setBountyAmount(Number(e.target.value))}
            min={1}
            max={100}
            placeholder="自定义金额（1-100）"
            className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-amber-300"
          />
          <DialogFooter>
            <button onClick={() => setBountyQ(null)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={confirmBounty}
              disabled={bountyBusy}
              className="h-9 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-full disabled:opacity-40"
            >
              {bountyBusy ? '处理中...' : `确认悬赏 ¥${bountyAmount || 0}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
