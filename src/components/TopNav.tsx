import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, Gift, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';

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

  // 签到状态（右上角签到系统，签到送赏金，复用 wallets 后端）
  const [checkedToday, setCheckedToday] = useState(false);
  const [checking, setChecking] = useState(false);
  // 钱包余额（右上角付费功能入口）
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser) { setCheckedToday(false); return; }
    let cancelled = false;
    api.getMyCheckin()
      .then((c: any) => { if (!cancelled) setCheckedToday(!!c?.checked_today); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleCheckin = async () => {
    if (!currentUser || checking || checkedToday) return;
    setChecking(true);
    try {
      const r = await api.checkin();
      setCheckedToday(true);
      toast.success(`签到成功！获得 ¥${r?.reward ?? 1}（连签 ${r?.streak ?? 1} 天）`);
      const w = await api.getMyWallet().catch(() => null);
      if (w) setWalletBalance(w.balance ?? 0);
    } catch (e: any) {
      toast.error(e?.message || '签到失败，请稍后再试');
    } finally {
      setChecking(false);
    }
  };

  // 钱包余额（右上角付费功能入口）
  useEffect(() => {
    if (!currentUser) { setWalletBalance(null); return; }
    api.getMyWallet().then((w: any) => setWalletBalance(w?.balance ?? 0)).catch(() => setWalletBalance(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const showTabs = ['/', '/hot', '/rank', '/follow'].includes(location.pathname);

  // 搜索行滚动隐藏（v34）：向下滚动隐藏搜索行，向上滚动或回到顶部恢复
  const [searchHidden, setSearchHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY + 4 && y > 60) setSearchHidden(true);
      else if (y < lastY - 4 || y < 60) setSearchHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-[720px] mx-auto px-4">
        {/* 搜索行：滚动时折叠（v34） */}
        <div className={`overflow-hidden transition-all duration-300 ${searchHidden ? 'max-h-0 opacity-0' : 'max-h-12 opacity-100'}`}>
        <div className="flex items-center gap-3 h-12">
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
            {/* 付费功能入口（右上角，跳转钱包/付费功能） */}
            {currentUser && (
              <button
                onClick={() => navigate('/consult-center')}
                title="付费功能 / 我的钱包"
                className="shrink-0 h-7 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all"
              >
                <Wallet className="w-3.5 h-3.5" />
                ¥{walletBalance ?? 0}
              </button>
            )}
            {/* 签到（右上角，签到送1元） */}
            {currentUser && (
              <button
                onClick={handleCheckin}
                disabled={checking || checkedToday}
                title="签到送1元"
                className={`shrink-0 h-7 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${checkedToday ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200 hover:from-amber-600 hover:to-orange-600'}`}
              >
                <Gift className="w-3.5 h-3.5" />
                {checkedToday ? '已签' : '签到'}
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Top tabs */}
        {showTabs && (
          <nav className="flex items-stretch h-[54px] -mb-px">
            {TOP_TABS.map((tab) => {
              const isActive = tab.path === '/'
                ? location.pathname === '/'
                : location.pathname === tab.path;
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  end={tab.path === '/'}
                  className={`relative flex-1 text-[15px] transition-colors h-full flex items-center justify-center ${
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
