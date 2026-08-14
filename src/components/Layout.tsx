import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopNav from '@/components/TopNav';
import BottomNav from '@/components/BottomNav';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/supabase';
import { publicTopic } from '@/lib/adminapi';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Ban, MicOff, Megaphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Layout = () => {
  const location = useLocation();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  // 惩罚横幅 + 申诉
  const [penalty, setPenalty] = useState<any>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 公告弹窗
  const [announcement, setAnnouncement] = useState<any>(null);

  // 应用图片加载模式（基本设置）
  useEffect(() => {
    store.applyImageMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录后:检查惩罚状态 + 拉取未读公告弹窗
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.getMyPenalty();
        if (!cancelled) setPenalty(p && p.type ? p : null);
      } catch { /* ignore */ }
      // 公告弹窗：取最新一条未读公告
      try {
        const anns = await publicTopic.getAnnouncements();
        if (anns.length === 0 || cancelled) return;
        const uid = await getCurrentUserId();
        if (!uid) return;
        for (const a of anns) {
          const { data: rd } = await supabase
            .from('read_messages')
            .select('id')
            .eq('user_id', uid)
            .eq('message_key', `ann_${a.id}`)
            .maybeSingle();
          if (!rd) {
            if (!cancelled) setAnnouncement(a);
            break;
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const submitAppeal = async () => {
    if (!penalty) return;
    if (appealText.trim().length < 5) {
      toast.error('申诉理由至少 5 个字');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitAppeal(penalty.id, appealText.trim());
      toast.success('申诉已提交，等待管理员处理');
      setAppealOpen(false);
      setAppealText('');
    } catch (e: any) {
      toast.error(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAnnouncement = async () => {
    const a = announcement;
    setAnnouncement(null);
    if (!a) return;
    try {
      const uid = await getCurrentUserId();
      if (uid) {
        await supabase.from('read_messages').insert({ user_id: uid, message_key: `ann_${a.id}` });
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAuthPage && <TopNav />}

      {/* 封禁/禁言全站横幅 */}
      {!isAuthPage && penalty && (
        <div className={`mx-auto max-w-[720px] px-4 pt-3 ${penalty.type === 'ban' ? '' : ''}`}>
          {penalty.type === 'ban' ? (
            <div className="rounded-2xl bg-red-600 text-white p-4 shadow-lg shadow-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold">你已被封禁</div>
                  <div className="text-xs text-red-100 mt-0.5">
                    {penalty.until ? `封禁至 ${new Date(penalty.until).toLocaleString('zh-CN')}` : '永久封禁'}
                    {penalty.reason ? ` · ${penalty.reason}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setAppealOpen(true)}
                  className="shrink-0 h-9 px-4 rounded-full bg-white text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  点击申诉
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-500 text-white p-4 shadow-lg shadow-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <MicOff className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold">你已被禁言</div>
                  <div className="text-xs text-amber-100 mt-0.5">
                    {penalty.until ? `禁言至 ${new Date(penalty.until).toLocaleString('zh-CN')}` : penalty.duration_hours === 0 ? '永久禁言' : `禁言 ${penalty.duration_hours} 小时`}
                    {penalty.reason ? ` · ${penalty.reason}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setAppealOpen(true)}
                  className="shrink-0 h-9 px-4 rounded-full bg-white text-amber-600 text-xs font-bold hover:bg-amber-50 transition-colors"
                >
                  点击申诉
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <main
        className={`mx-auto max-w-[720px] ${
          isAuthPage ? '' : 'pb-16'
        }`}
      >
        <Outlet />
      </main>

      {!isAuthPage && <BottomNav />}

      {/* 申诉弹窗 */}
      <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>账号申诉</DialogTitle>
            <DialogDescription>
              {penalty?.type === 'ban' ? '如你认为封禁有误，请说明情况，管理员将尽快审核。' : '如你认为禁言有误，请说明情况，管理员将尽快审核。'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-28 rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-amber-300"
            placeholder="请描述申诉理由（至少 5 个字）..."
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
          />
          <DialogFooter>
            <button onClick={() => setAppealOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
              取消
            </button>
            <button
              onClick={submitAppeal}
              disabled={submitting}
              className="h-9 px-6 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-40"
            >
              {submitting ? '提交中...' : '提交申诉'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 公告弹窗 */}
      <Dialog open={!!announcement} onOpenChange={(o) => !o && confirmAnnouncement()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-blue-600" />
                {announcement?.title || '官方公告'}
              </span>
            </DialogTitle>
            <DialogDescription>修仙问答官方消息</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3.5 text-sm text-gray-700 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
            {announcement?.content}
          </div>
          <DialogFooter>
            <button
              onClick={confirmAnnouncement}
              className="h-10 px-8 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700"
            >
              我知道了
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
