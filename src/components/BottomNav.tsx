import { NavLink, useLocation } from 'react-router-dom';
import { User, PenSquare, Home } from 'lucide-react';
import { useXiuxianStore } from '@/store/useStore';

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

  // 编辑/聊天类页面隐藏底栏（登录/注册由 Layout 处理）；其余页面底栏常驻
  const hidePaths = ['/answer/', '/comments/', '/messages/private/'];
  if (hidePaths.some((p) => location.pathname.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] z-40 pb-safe">
      <div className="flex items-stretch h-16 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 shadow-[0_-4px_20px_rgba(0,0,0,0.25)] backdrop-blur">
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
          <Home className={`w-6 h-6 ${isActive('/') && location.pathname === '/' ? 'drop-shadow-[0_0_6px_rgba(96,165,250,0.9)]' : ''}`} />
          <span className="text-[11px] font-medium">主页</span>
        </NavLink>

        {/* 提问：红色凸起大按钮 */}
        <NavLink
          to="/ask"
          className="flex items-center justify-center px-6 bg-gradient-to-br from-red-600 to-red-500 text-white font-bold text-[13px] tracking-wide shadow-[0_4px_16px_rgba(244,63,94,0.45)] hover:shadow-[0_4px_20px_rgba(244,63,94,0.65)] hover:brightness-105 active:brightness-95 active:scale-[0.98] transition-all"
        >
          <span className="flex items-center gap-1.5">
            <PenSquare className="w-4 h-4" />
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
          <User className={`w-6 h-6 ${isActive('/profile') ? 'drop-shadow-[0_0_6px_rgba(0,132,255,0.9)]' : ''}`} />
          <span className="text-[11px] font-medium">{currentUser ? '我的' : '登录'}</span>
        </NavLink>
      </div>
    </nav>
  );
}
