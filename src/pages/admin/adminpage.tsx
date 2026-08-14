import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield, Flag, School, FileText, History, LogOut,
  LayoutDashboard, Users, Megaphone, ChevronLeft, Menu, Coins, EyeOff, Ticket, BadgeCheck, Crown, PackageSearch,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useXiuxianStore } from '@/store/useStore';
import { adminApi } from '@/lib/adminapi';
import AdminDashboardPage from './admindashboardpage';
import AdminReportsPage from './adminreportspage';
import AdminContentPage from './admincontentpage';
import AdminUsersPage from './adminuserspage';
import AdminUniversitiesPage from './adminuniversitiespage';
import AdminAnnouncementsPage from './adminannouncementspage';
import AdminConsultationsPage from './adminconsultationspage';
import AdminChangesPage from './adminchangespage';
import AdminInvitePage from './admininvitepage';
import AdminReviewsPage from './adminreviews';
import AdminVerificationsPage from './adminverificationspage';
import PlatformAdPage from './platformadpage';
import AdminBeautyPage from './adminbeautypage';
import AdminCommunityPage from './admincommunitypage';

type Tab = 'dashboard' | 'reports' | 'content' | 'users' | 'universities' | 'announcements' | 'consultations' | 'changes' | 'reviews' | 'invite' | 'verifications' | 'platformad' | 'beauty' | 'community';

export default function AdminPage() {
  usePageTitle('管理后台');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const urlTab = searchParams.get('tab') as Tab | null;
  const [tabState, setTabState] = useState<Tab>('dashboard');
  const tab: Tab = urlTab && ['dashboard','reports','content','users','universities','announcements','consultations','changes','reviews','invite','verifications','platformad','beauty','community'].includes(urlTab) ? urlTab : tabState;
  const setTab = (t: Tab) => { setTabState(t); setSearchParams({ tab: t }, { replace: true }); };
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReports, setPendingReports] = useState(0);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await adminApi.checkAdmin();
      setIsAdmin(ok);
      setChecked(true);
      if (ok) {
        try {
          const s = await adminApi.getStats();
          setPendingReports(s.pendingReports);
        } catch { /* ignore */ }
      }
    })();
  }, []);

  // 轮询待处理举报数（每 30 秒）
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(async () => {
      try {
        const s = await adminApi.getStats();
        setPendingReports(s.pendingReports);
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(t);
  }, [isAdmin]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="管理后台" />
        <div className="text-center py-20 text-gray-400 text-sm">权限校验中...</div>
      </div>
    );
  }

  if (!isAdmin || !currentUser?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="管理后台" />
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Shield className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 mb-1">无权访问管理后台</p>
          <p className="text-xs text-gray-400 mb-6">需要管理员账号（profiles.is_admin = true）</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const MENUS: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
    { key: 'reports', label: '举报审核', icon: Flag, badge: pendingReports },
    { key: 'reviews', label: '审核中心', icon: EyeOff },
    { key: 'content', label: '内容管理', icon: FileText },
    { key: 'users', label: '用户管理', icon: Users },
    { key: 'universities', label: '高校管理', icon: School },
    { key: 'verifications', label: '认证审核', icon: BadgeCheck },
    { key: 'platformad', label: '广告平台', icon: Megaphone },
    { key: 'beauty', label: '评选管理', icon: Crown },
    { key: 'community', label: '社区管理', icon: PackageSearch },
    { key: 'announcements', label: '运营公告', icon: Megaphone },
    { key: 'consultations', label: '咨询审核', icon: Coins },
    { key: 'changes', label: '变更回滚', icon: History },
    { key: 'invite', label: '邀请码', icon: Ticket },
  ];

  const Sidebar = (
    <aside className="w-52 bg-[#16233b] text-gray-300 flex flex-col shrink-0 min-h-screen sticky top-0 self-start">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">知</div>
        <span className="text-white font-semibold text-sm">修仙问答管理台</span>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {MENUS.map((m) => (
          <button
            key={m.key}
            onClick={() => { setTab(m.key); setSideOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              tab === m.key ? 'bg-blue-600 text-white font-medium' : 'hover:bg-white/5 text-gray-300'
            }`}
          >
            <m.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{m.label}</span>
            {!!m.badge && m.badge > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                {m.badge > 99 ? '99+' : m.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(currentUser.nickname || '管').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-white truncate">{currentUser.nickname}</div>
            <div className="text-[10px] text-gray-400">超级管理员</div>
          </div>
        </div>
        <button
          onClick={() => { store.logout(); navigate('/'); }}
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-white/5 text-xs text-gray-300 hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> 退出登录
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      {/* 桌面侧边栏 */}
      <div className="hidden md:block shrink-0">{Sidebar}</div>

      {/* 移动端顶栏 */}
      <div className="md:hidden bg-[#16233b] text-white h-12 flex items-center px-3 sticky top-0 z-40">
        <button onClick={() => setSideOpen(!sideOpen)} className="p-1.5 -ml-1.5">
          {sideOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="text-sm font-semibold ml-1">修仙问答管理台</span>
        <span className="ml-auto text-[10px] text-gray-300">{currentUser.nickname}</span>
      </div>

      {/* 移动端抽屉侧边栏 */}
      {sideOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-52 bg-[#16233b] h-full flex flex-col">{Sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setSideOpen(false)} />
        </div>
      )}

      {/* 主内容区 */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          {/* 移动端 Tab 条 */}
          <div className="md:hidden bg-white rounded-xl p-1 flex overflow-x-auto mb-4 sticky top-12 z-30">
            {MENUS.map((m) => (
              <button
                key={m.key}
                onClick={() => setTab(m.key)}
                className={`relative flex-none px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-1 ${
                  tab === m.key ? 'bg-blue-600 text-white' : 'text-gray-500'
                }`}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
                {!!m.badge && m.badge > 0 && (
                  <span className="min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
                    {m.badge > 99 ? '99+' : m.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 桌面页头 */}
          <div className="hidden md:flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {MENUS.find((m) => m.key === tab)?.label}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">修仙问答运营管理平台 · 欢迎回来，{currentUser.nickname}</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              超级管理员
            </span>
          </div>

          {tab === 'dashboard' && <AdminDashboardPage />}
          {tab === 'reports' && <AdminReportsPage />}
          {tab === 'reviews' && <AdminReviewsPage />}
          {tab === 'content' && <AdminContentPage />}
          {tab === 'users' && <AdminUsersPage />}
          {tab === 'universities' && <AdminUniversitiesPage />}
          {tab === 'verifications' && <AdminVerificationsPage />}
          {tab === 'platformad' && <PlatformAdPage />}
          {tab === 'beauty' && <AdminBeautyPage />}
          {tab === 'community' && <AdminCommunityPage />}
          {tab === 'announcements' && <AdminAnnouncementsPage />}
          {tab === 'consultations' && <AdminConsultationsPage />}
          {tab === 'changes' && <AdminChangesPage />}
          {tab === 'invite' && <AdminInvitePage />}
        </div>
      </main>
    </div>
  );
}
