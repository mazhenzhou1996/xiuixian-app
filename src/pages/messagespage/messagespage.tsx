import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Heart,
  UserPlus,
  Bell,
  PenLine,
  ChevronRight,
  Trash2,
  Megaphone,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { publicTopic } from '@/lib/adminapi';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

interface SectionDef {
  key: string;
  label: string;
  icon: typeof Bell;
  color: string;
  path: string;
}

const SECTIONS: SectionDef[] = [
  { key: 'official', label: '官方消息', icon: Bell, color: 'text-purple-600 bg-purple-50', path: '/messages/official' },
  { key: 'comment', label: '评论', icon: MessageCircle, color: 'text-blue-600 bg-blue-50', path: '/messages/comment' },
  { key: 'like', label: '点赞', icon: Heart, color: 'text-red-600 bg-red-50', path: '/messages/like' },
  { key: 'follow', label: '关注', icon: UserPlus, color: 'text-green-600 bg-green-50', path: '/messages/follow' },
  { key: 'invite', label: '邀请回答', icon: PenLine, color: 'text-indigo-600 bg-indigo-50', path: '/messages/invite' },
];

export default function MessagesPage() {
  usePageTitle('消息');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    // 官方信息是公开数据，独立于登录状态加载
    publicTopic.getAnnouncements().then(setAnnouncements).catch(() => {});
    if (!currentUser) return;
    (async () => {
      const msgs = await store.getUserMessages(currentUser.id);
      setMessages(msgs);
      const unread = await store.getUnreadCount(currentUser.id);
      setUnreadTotal(unread);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="消息" />
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-4">登录后查看消息</p>
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

  const trashed = store.getTrashedMessages();
  const trashedKeys = new Set(trashed.map((t) => t.key));
  const visibleMessages = messages.filter((m) => !trashedKeys.has(String(m.id)));

  const countByType = (type: string) => visibleMessages.filter((m) => m.type === type).length;
  const unreadByType = (type: string) => visibleMessages.filter((m) => m.type === type && !m.read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="消息" />

      <div className="px-4 py-3">
        {/* 官方信息（置顶展示，点击进入官方消息） */}
        {announcements.length > 0 && (
          <div className="mb-3 bg-white rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
              <Megaphone className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-gray-700">官方信息</span>
              <button
                onClick={() => navigate('/messages/official')}
                className="ml-auto text-[11px] text-gray-400 hover:text-blue-600"
              >
                查看全部
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {announcements.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  onClick={() => navigate('/messages/official')}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800 font-medium">{a.title}</span>
                    <span className="text-[10px] text-gray-400">{formatTime(new Date(a.created_at).getTime())}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{a.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {SECTIONS.map((s) => {
            const total = countByType(s.key);
            const unread = unreadByType(s.key);
            return (
              <div
                key={s.key}
                onClick={() => navigate(s.path)}
                className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-full ${s.color} flex items-center justify-center shrink-0`}>
                  <s.icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-sm text-gray-700 flex-1">{s.label}</span>
                <span className="text-xs text-gray-400">{total}</span>
                {unread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            );
          })}

          {/* 回收箱 */}
          <div
            onClick={() => navigate('/messages/trash')}
            className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <span className="text-sm text-gray-700 flex-1">回收箱</span>
            {trashed.length > 0 && (
              <span className="text-xs text-gray-400">{trashed.length}</span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>

        {unreadTotal > 0 && (
          <div className="text-center text-xs text-gray-400 mt-4">
            共 {unreadTotal} 条未读消息
          </div>
        )}
      </div>
    </div>
  );
}
