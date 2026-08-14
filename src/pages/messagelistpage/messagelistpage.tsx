import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Heart,
  Bookmark,
  UserPlus,
  Bell,
  PenLine,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

const TYPE_LABELS: Record<string, string> = {
  official: '官方消息',
  comment: '评论',
  like: '点赞',
  favorite: '收藏',
  follow: '关注',
  invite: '邀请回答',
};

export default function MessageListPage() {
  const { type = 'official' } = useParams<{ type: string }>();
  usePageTitle(TYPE_LABELS[type] || '消息');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const msgs = await store.getUserMessages(currentUser.id);
      setMessages(msgs);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title={TYPE_LABELS[type] || '消息'} />
        <div className="text-center py-20 text-gray-400 text-sm">
          登录后查看消息
        </div>
      </div>
    );
  }

  const trashed = store.getTrashedMessages();
  const trashedKeys = new Set(trashed.map((t) => t.key));
  const list = messages.filter((m) => m.type === type && !trashedKeys.has(String(m.id)));

  const handleMarkAllRead = async () => {
    if (list.every((m) => m.read)) return;
    await store.markAllRead(currentUser.id);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    toast.success('已全部标为已读');
  };

  const handleDelete = (msg: any) => {
    store.trashMessage(String(msg.id));
    setConfirmKey(null);
    setMessages((prev) => prev.map((m) => (String(m.id) === String(msg.id) ? { ...m, read: true } : m)));
    toast.success('已删除，可在回收箱恢复（15天内）');
  };

  const getIcon = (t: string) => {
    switch (t) {
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'like': return <Heart className="w-5 h-5 text-red-500" />;
      case 'favorite': return <Bookmark className="w-5 h-5 text-blue-500" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'answer': return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'invite': return <PenLine className="w-5 h-5 text-purple-500" />;
      case 'official': return <Bell className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getIconBg = (t: string) => {
    switch (t) {
      case 'comment': return 'bg-blue-50';
      case 'like': return 'bg-red-50';
      case 'favorite': return 'bg-blue-50';
      case 'follow': return 'bg-green-50';
      case 'answer': return 'bg-blue-50';
      case 'invite': return 'bg-purple-50';
      case 'official': return 'bg-purple-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={TYPE_LABELS[type] || '消息'}
        rightAction={
          <button
            onClick={handleMarkAllRead}
            disabled={list.length === 0 || list.every((m) => m.read)}
            className="flex items-center gap-1 text-xs text-blue-600 disabled:text-gray-300"
          >
            <CheckCheck className="w-4 h-4" />
            一键已读
          </button>
        }
      />

      <div className="px-4 py-2">
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {list.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-sm">
              该板块暂无消息
            </div>
          )}

          {list.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 p-4">
              <div
                className={`w-10 h-10 rounded-full ${getIconBg(msg.type)} flex items-center justify-center shrink-0`}
              >
                {msg.userAvatar ? (
                  <img
                    src={msg.userAvatar}
                    alt={msg.userName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  getIcon(msg.type)
                )}
              </div>

              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  if (msg.targetId && msg.type !== 'follow') {
                    navigate(`/question/${msg.targetId}`);
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {msg.userName || '系统通知'}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed pr-6">
                  {msg.content}
                </p>
              </div>

              {/* 右下角删除按钮 */}
              <div className="flex flex-col items-center justify-between self-stretch shrink-0 py-0.5">
                {!msg.read && <div className="w-2 h-2 rounded-full bg-blue-600 mt-1" />}
                <button
                  onClick={() => setConfirmKey(String(msg.id))}
                  className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  aria-label="删除消息"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 删除确认 */}
      <AlertDialog open={!!confirmKey} onOpenChange={(o) => !o && setConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条消息？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将移入回收箱，15 天内可以恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                const msg = list.find((m) => String(m.id) === confirmKey);
                if (msg) handleDelete(msg);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
