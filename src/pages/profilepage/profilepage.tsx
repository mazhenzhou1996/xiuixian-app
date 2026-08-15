import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  MessageCircle,
  FileQuestion,
  PenLine,
  ThumbsUp,
  History,
  ChevronRight,
  Users,
  Headphones,
  Settings,
  Shield,
  ShieldCheck,
  Coins,
  Trash2,
  Star,
  Send,
  Download,
  FileText,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { getProgress, REPUTATION_RULES } from '@/data/realmlevels';
import { formatCount, REALM_LABELS } from '@/utils/format';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';

// 联系客服 - QQ 群（占位群号，替换成真实群号即可）
const QQ_GROUPS = ['100000001', '100000002', '100000003', '100000004'];

export default function ProfilePage() {
  usePageTitle('我的');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myAnswers, setMyAnswers] = useState<any[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  // 声望晋级状态
  const [promo, setPromo] = useState<any>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    if (currentUser) api.getMyPromotion().then(setPromo).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const followers = await store.getFollowers(currentUser.id);
      setFollowerCount(followers);
      const following = await store.getFollowing(currentUser.id);
      setFollowingCount(following);
      const answers = await store.loadUserAnswers(currentUser.id);
      setMyAnswers(answers);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的" showBack={false} />
        <div className="px-4 py-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
            <Users className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">登录以体验完整功能</h2>
          <p className="text-sm text-gray-400 mb-6">提问、回答、关注道友，尽在修仙问答</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-full"
            >
              登录
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-2.5 bg-white text-blue-600 font-medium rounded-full border border-blue-200"
            >
              注册
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myQuestions = store.getQuestions().filter((q) => q.userId === currentUser.id);

  const handleApplyPromotion = async () => {
    try {
      const r = await api.applyPromotion();
      toast.success(`已提交晋级申请：「${r.to_name}」，等待管理员审核`);
      api.getMyPromotion().then(setPromo).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || '申请失败');
    }
  };

  const { percent: promoPercent } = getProgress(currentUser.points, currentUser.realm, (currentUser as any).stage || 'early');
  const likedTargets = store.getLikedTargets();
  const viewHistory = store.getViewHistory();
  const settings = store.getSettings();

  const handleLogout = () => {
    store.logout();
    toast.success('已退出登录');
    navigate('/', { replace: true });
  };

  const menuItems = [
    { label: '我的消息', icon: MessageCircle, color: 'text-blue-600 bg-blue-50', count: null, path: '/messages' },
    { label: '信誉系统', icon: ShieldCheck, color: 'text-green-600 bg-green-50', count: null, path: '/credit' },
    { label: '付费功能', icon: Coins, color: 'text-amber-600 bg-amber-50', count: null, path: '/consult-center' },
    { label: '我的收益', icon: Coins, color: 'text-emerald-600 bg-emerald-50', count: null, path: '/my/earnings' },
    { label: '回收箱', icon: Trash2, color: 'text-gray-600 bg-gray-100', count: null, path: '/recycle' },
    { label: '私信', icon: MessageCircle, color: 'text-teal-600 bg-teal-50', count: null, path: '/messages/private' },
    { label: '我的提问', icon: FileQuestion, color: 'text-blue-600 bg-blue-50', count: myQuestions.length, path: '/my/questions' },
{ label: '我的收藏', icon: Star, color: 'text-amber-600 bg-amber-50', count: null, path: '/my/favorites' },
{ label: '我的邀请', icon: Send, color: 'text-indigo-600 bg-indigo-50', count: null, path: '/my/invites' },
    { label: '我的回答', icon: PenLine, color: 'text-green-600 bg-green-50', count: myAnswers.length, path: '/my/answers' },
    { label: '我的点赞', icon: ThumbsUp, color: 'text-red-600 bg-red-50', count: likedTargets.length, path: '/my/likes' },
    { label: '浏览历史', icon: History, color: 'text-purple-600 bg-purple-50', count: viewHistory.length, path: '/my/history' },
  ];

  const bottomItems = [
    ...(currentUser?.isAdmin ? [{ label: '管理后台', icon: Shield, color: 'text-violet-600 bg-violet-50', count: null, path: '/admin' }] : []),
    { label: '联系客服', icon: Headphones, color: 'text-teal-600 bg-teal-50', count: null, onClick: () => setContactOpen(true) },
    { label: '设置', icon: Settings, color: 'text-gray-600 bg-gray-100', count: null, path: '/settings' },
  ];
  // 关于组（v37）：下载 / 隐私 / 协议 / 版本日志
  const aboutItems = [
    { label: '下载 App', icon: Download, color: 'text-blue-600 bg-blue-50', count: null, path: '/download' },
    { label: '隐私政策', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50', count: null, path: '/privacy' },
    { label: '用户协议', icon: FileText, color: 'text-blue-600 bg-blue-50', count: null, path: '/terms' },
    { label: '版本日志', icon: History, color: 'text-blue-600 bg-blue-50', count: null, path: '/changelog' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="我的" showBack={false} />

      {/* Profile card */}
      <div className="px-4 py-3">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute right-12 bottom-0 w-16 h-16 rounded-full bg-white/10" />

          <div className="relative z-10 flex items-start gap-4">
            <Avatar
              src={currentUser.avatar}
              alt={currentUser.nickname}
              className="w-16 h-16 border-2 border-white/40"
              bgClass="bg-gradient-to-br from-blue-500 to-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold truncate">{currentUser.nickname}</h2>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white">
                  {REALM_LABELS[currentUser.realm as keyof typeof REALM_LABELS] || currentUser.realm}
                </span>
              </div>
              <p className="text-xs text-blue-100 line-clamp-1 mb-2">
                {currentUser.bio || '这位道友很低调，什么都没留下'}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-blue-100 mb-2 flex-wrap">
                {settings.school && <span>🏫 {settings.school}</span>}
                {settings.location && <span>📍 {settings.location}</span>}
              </div>
              <button
                onClick={() => navigate('/settings/profile')}
                className="h-7 px-4 rounded-full bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors"
              >
                编辑资料
              </button>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="font-bold text-base">{followerCount}</span>
                  <span className="text-blue-100 ml-1">关注者</span>
                </div>
                <div>
                  <span className="font-bold text-base">{followingCount}</span>
                  <span className="text-blue-100 ml-1">关注了</span>
                </div>
                <div>
                  <span className="font-bold text-base">
                    {formatCount(currentUser.points)}
                  </span>
                  <span className="text-blue-100 ml-1">声望</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 账户充值（醒目 CTA，跳转付费功能） */}
      <div className="px-4">
        <button
          onClick={() => navigate('/consult-center')}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#0084FF] to-[#4DA6FF] text-white text-sm font-bold shadow-md shadow-[#0084FF]/30 flex items-center justify-center gap-2 hover:from-[#0066CC] hover:to-[#0084FF] active:scale-[0.98] transition-all"
        >
          <Coins className="w-4 h-4" />
          账户充值
        </button>
      </div>

      {/* 声望晋级卡片 */}
      <div className="px-4 py-3">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">声望晋级</span>
            <span className="text-xs text-gray-400">当前境界：{promo?.current_name || REALM_LABELS[currentUser.realm as keyof typeof REALM_LABELS] || '练气'}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl font-bold text-blue-600">{formatCount(currentUser.points)}</span>
            <span className="text-xs text-gray-400">声望</span>
            {promo?.next_name ? (
              <span className="ml-auto text-[11px] text-gray-500">下一境界：{promo.next_name}（需 {formatCount(promo.next_min)}）</span>
            ) : (
              <span className="ml-auto text-[11px] text-amber-600">已达最高境界</span>
            )}
          </div>
          {/* 进度条 */}
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{ width: `${promoPercent}%` }}
            />
          </div>
          {promo?.pending_id ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5 text-xs text-amber-600 mb-2">
              晋级申请审核中：{promo.pending_to}
            </div>
          ) : promo?.next_name ? (
            <button
              onClick={handleApplyPromotion}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium shadow-md shadow-blue-100 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all"
            >
              申请晋级至「{promo.next_name}」
            </button>
          ) : null}
          <button
            onClick={() => setRulesOpen(!rulesOpen)}
            className="w-full text-center text-[11px] text-gray-400 mt-2.5"
          >
            声望获取规则 {rulesOpen ? '收起 ▲' : '展开 ▼'}
          </button>
          {rulesOpen && (
            <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1.5">
              {REPUTATION_RULES.map((r) => (
                <div key={r.action} className="flex justify-between">
                  <span>{r.action}</span>
                  <span className="text-blue-600 font-medium">+{r.points}</span>
                </div>
              ))}
              <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                声望达标后提交晋级申请，由管理员审核通过后晋升境界
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu list */}
      <div className="px-4 mb-3">
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {menuItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              {item.count !== null && (
                <span className="text-xs text-gray-400">{item.count}</span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>

        {/* 联系客服 + 设置 */}
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden mt-3">
          {bottomItems.map((item) => (
            <div
              key={item.label}
              onClick={() => (item.onClick ? item.onClick() : navigate(item.path!))}
              className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>

        {/* 关于（v37） */}
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden mt-3">
          {aboutItems.map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.path!)}
              className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 pt-4">
        <button
          onClick={handleLogout}
          className="w-full h-11 bg-white text-gray-500 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>

      {/* 版本信息（v38） */}
      <div className="px-4 pt-3 pb-1 text-center text-[10px] text-gray-300">
        修仙问答 v39 · 2026-08-15
      </div>

      {/* 联系客服弹窗 */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>联系客服</DialogTitle>
            <DialogDescription>
              欢迎加入修仙问答官方 QQ 交流群，与道友们一起论道：
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {QQ_GROUPS.map((g, i) => (
              <div
                key={g}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center"
              >
                <div className="text-xs text-gray-400 mb-0.5">官方群 {i + 1}</div>
                <div className="text-sm font-semibold text-gray-800 tracking-wider">{g}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={() => setContactOpen(false)}
              className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700"
            >
              确认
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
