import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronRight, UserPlus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PrivateMessagesPage() {
  usePageTitle('私信');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [refreshKey, setRefreshKey] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    store.getPmConversations().then(setConversations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshKey]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="私信" />
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-4">登录后查看私信</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  const users = store.getUsers();

  const resolveUser = (uid: string) => users.find((u: any) => String(u.id) === String(uid));

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="私信"
        rightAction={
          <button
            onClick={() => setStartOpen(true)}
            className="flex items-center gap-1 text-xs text-blue-600"
          >
            <UserPlus className="w-4 h-4" />
            发起私信
          </button>
        }
      />

      <div className="px-4 py-2">
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {/* 真实会话（数据库） */}
          {conversations.map((c) => {
            const u = c.peer || resolveUser(c.userId);
            return (
              <div
                key={c.userId}
                onClick={() => navigate(`/messages/private/${c.userId}`)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <Avatar src={u?.avatar} alt={u?.nickname || '道友'} className="w-11 h-11" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{u?.nickname || '道友'}</span>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">{c.lastMsg}</div>
                </div>
                <div className="text-[10px] text-gray-300 shrink-0">{formatTime(c.lastTime)}</div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            );
          })}

          {conversations.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-sm text-gray-400">暂无会话，点右上角发起私信</p>
            </div>
          )}
        </div>
      </div>

      {/* 发起私信 */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发起私信</DialogTitle>
            <DialogDescription>选择一位道友开始对话</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {users.filter((u: any) => String(u.id) !== String(currentUser.id)).map((u: any) => (
              <div
                key={u.id}
                onClick={() => { setStartOpen(false); setRefreshKey((k) => k + 1); navigate(`/messages/private/${u.id}`); }}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 rounded-lg"
              >
                <Avatar src={u.avatar} alt={u.nickname} className="w-9 h-9" />
                <span className="text-sm text-gray-700">{u.nickname}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={() => setStartOpen(false)}
              className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full"
            >
              取消
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
