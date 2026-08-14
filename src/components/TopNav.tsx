import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useXiuxianStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

const TOP_TABS = [
  { path: '/', label: '推荐' },
  { path: '/hot', label: '热榜' },
  { path: '/bounty', label: '悬赏' },
  { path: '/rank', label: '排行榜' },
  { path: '/follow', label: '关注' },
];

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const showTabs = ['/', '/hot', '/rank', '/follow'].includes(location.pathname);

  // 未读通知数（TopNav 红点）+ Realtime 实时刷新
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const uid = String(currentUser.id);
    const refresh = () =>
      store.getUnreadNotificationCount().then((c) => { if (!cancelled) setUnreadCount(c); });
    refresh();
    // v16：60s 轮询兜底（Realtime 断连时未读数仍能刷新）
    const timer = setInterval(refresh, 60_000);
    // Realtime：订阅自己的通知插入事件（表未建时静默不触发）
    let channel: any;
    try {
      channel = supabase
        .channel(`notif:${uid}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${uid}`,
        }, () => refresh())
        .subscribe();
    } catch { /* ignore */ }
    return () => {
      cancelled = true;
      clearInterval(timer);
      try { if (channel) supabase.removeChannel(channel); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-[720px] mx-auto px-4">
        <div className="flex items-center gap-3 h-12">
          {/* Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">知</span>
            </div>
            <span className="font-semibold text-sm text-gray-900 hidden sm:block">修仙问答</span>
          </div>

          {/* Search bar */}
          <button
            onClick={() => navigate('/search')}
            className="flex-1 flex items-center gap-2 h-8 px-3 rounded-full bg-gray-100 text-gray-400 text-xs hover:bg-gray-200 transition-colors"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">搜索修仙问题...</span>
          </button>

          {/* Messages / Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(currentUser ? '/notifications' : '/login')}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-blue-600 relative"
              aria-label="通知"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate(currentUser ? '/profile' : '/login')}
              className="shrink-0"
              aria-label="我的"
            >
              {currentUser ? (
                <Avatar
                  src={currentUser.avatar}
                  alt={currentUser.nickname}
                  className="w-7 h-7"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                  登
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Top tabs */}
        {showTabs && (
          <nav className="flex items-center gap-5 h-10 -mb-px">
            {TOP_TABS.map((tab) => {
              const isActive = tab.path === '/'
                ? location.pathname === '/'
                : location.pathname === tab.path;
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  end={tab.path === '/'}
                  className={`relative text-sm transition-colors h-full flex items-center ${
                    isActive
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
