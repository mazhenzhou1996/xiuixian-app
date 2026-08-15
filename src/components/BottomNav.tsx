import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User, PenSquare, Home } from 'lucide-react';
import { useXiuxianStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';

/**
 * 底部导航（v17 焕新）
 * - 全端常驻显示（去掉 md:hidden，桌面同样显示）
 * - 深色渐变底 + 彩色高亮，提问按钮红色凸起
 * - 仅登录/注册、写回答、评论页隐藏（避免误触编辑场景）
 */
export default function BottomNav() {
  const location = useLocation();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  // 未读通知数（v34：从顶栏迁移到「我的」tab 徽标）+ Realtime 实时刷新
  const [unreadCount, setUnreadCount] = useState(0);
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
    // 60s 轮询兜底（Realtime 断连时未读数仍能刷新）
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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] z-40 pb-safe">
      <div className="flex items-stretch h-11 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-[0_-4px_20px_rgba(0,0,0,0.25)] backdrop-blur">
        {/* 首页 */}
        <NavLink
          to="/"
          end
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive('/') && location.pathname === '/'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className={`w-5 h-5 ${isActive('/') && location.pathname === '/' ? 'drop-shadow-[0_0_6px_rgba(96,165,250,0.9)]' : ''}`} />
          <span className="text-[10px] font-medium">主页</span>
        </NavLink>

        {/* 提问：红色凸起大按钮 */}
        <NavLink
          to="/ask"
          className="flex items-center justify-center px-3 bg-gradient-to-br from-red-600 to-red-500 text-white font-bold text-[12px] tracking-wide shadow-[0_4px_16px_rgba(244,63,94,0.45)] hover:shadow-[0_4px_20px_rgba(244,63,94,0.65)] hover:brightness-105 active:brightness-95 active:scale-[0.98] transition-all"
        >
          <span className="flex items-center gap-1.5">
            <PenSquare className="w-3.5 h-3.5" />
            提问&悬赏
          </span>
        </NavLink>

        {/* 我的 / 登录 */}
        <NavLink
          to="/profile"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive('/profile')
              ? 'text-[#0084FF]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <User className={`w-5 h-5 ${isActive('/profile') ? 'drop-shadow-[0_0_6px_rgba(0,132,255,0.9)]' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[15px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-red-900/40">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">{currentUser ? '我的' : '登录'}</span>
        </NavLink>
      </div>
    </nav>
  );
}
