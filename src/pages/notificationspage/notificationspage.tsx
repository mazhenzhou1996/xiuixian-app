import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Heart, MessageCircle, MessageSquare, UserPlus, Mail, PenLine, Megaphone, CheckCheck,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  answer:  { icon: MessageCircle, color: 'text-blue-600',   bg: 'bg-blue-50',   label: '回答' },
  comment: { icon: MessageSquare, color: 'text-cyan-600',   bg: 'bg-cyan-50',   label: '评论' },
  like:    { icon: Heart,         color: 'text-red-600',    bg: 'bg-red-50',    label: '点赞' },
  follow:  { icon: UserPlus,      color: 'text-green-600',  bg: 'bg-green-50',  label: '关注' },
  pm:      { icon: Mail,          color: 'text-indigo-600', bg: 'bg-indigo-50', label: '私信' },
  invite:  { icon: PenLine,       color: 'text-violet-600', bg: 'bg-violet-50', label: '邀请' },
  system:  { icon: Megaphone,     color: 'text-purple-600', bg: 'bg-purple-50', label: '系统' },
};

function resolveLink(n: any): string {
  if (n.link) return n.link;
  switch (n.type) {
    case 'follow': return n.actorId ? `/user/${n.actorId}` : '/messages';
    case 'pm': return n.actorId ? `/messages/private/${n.actorId}` : '/messages/private';
    case 'answer':
    case 'comment': return n.targetId ? `/question/${n.targetId}` : '/messages';
    case 'like': return n.targetId ? `/question/${n.targetId}` : '/messages/like';
    case 'invite': return n.targetId ? `/question/${n.targetId}` : '/messages/invite';
    default: return '/messages/official';
  }
}

export default function NotificationsPage() {
  usePageTitle('通知');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE = 30;

  const load = useCallback(async (reset = true) => {
    if (!currentUser) { setLoading(false); return; }
    try {
      const next = reset ? 0 : offset;
      const list = await store.getNotifications(PAGE, next);
      if (reset) {
        setItems(list);
        setOffset(PAGE);
      } else {
        setItems((prev) => [...prev, ...list]);
        setOffset(next + PAGE);
      }
      setHasMore(list.length === PAGE);
      setUnread(await store.getUnreadNotificationCount());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, offset]);

  useEffect(() => { load(); }, [load]);

  // v16：60s 轮询兜底（Realtime 未接入通知页时未读/新通知仍能刷新）
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(() => { load(false); }, 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="通知" />
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-4">登录后查看通知</p>
          <button onClick={() => navigate('/login')} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full">
            去登录
          </button>
        </div>
      </div>
    );
  }

  const handleClick = async (n: any) => {
    if (!n.read) {
      try {
        await store.markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
      } catch { /* ignore */ }
    }
    navigate(resolveLink(n));
  };

  const markAll = async () => {
    try {
      await store.markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="通知"
        rightAction={
          unread > 0 ? (
            <button onClick={markAll} className="flex items-center gap-1 text-xs text-blue-600">
              <CheckCheck className="w-3.5 h-3.5" /> 全部已读
            </button>
          ) : undefined
        }
      />

      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            暂无通知
          </div>
        ) : (
          <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
            {items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.system;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 p-3.5 text-left transition-colors ${n.read ? 'bg-white' : 'bg-blue-50/40'} hover:bg-gray-50`}
                >
                  {n.actorAvatar ? (
                    <Avatar src={n.actorAvatar} alt={n.actorName} className="w-9 h-9 shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${meta.color}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 leading-snug">
                      {n.actorName && <span className="font-medium">{n.actorName} </span>}
                      <span className="text-gray-500">{n.title || meta.label}</span>
                    </div>
                    {n.body && n.body !== n.title && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1">{formatTime(new Date(n.createdAt).getTime())}</div>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loading && unread > 0 && (
          <div className="text-center text-xs text-gray-400 mt-4">共 {unread} 条未读通知</div>
        )}

        {!loading && items.length > 0 && hasMore && (
          <div className="px-4 mt-3">
            <button
              onClick={() => load(false)}
              className="w-full h-10 rounded-full bg-white border border-gray-200 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
