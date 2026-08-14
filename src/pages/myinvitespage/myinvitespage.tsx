import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, BadgeCheck, Trophy, Inbox } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { api } from '@/lib/api';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * 我的邀请（v19）
 * 收到的回答邀请：本校认证修士邀请 + 悬赏榜邀请推送
 */
export default function MyInvitesPage() {
  usePageTitle('我的邀请');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setInvites(await api.listMyInvites(50));
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentUser = store.getCurrentUser();
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的邀请" />
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-4">登录后查看邀请</p>
          <button onClick={() => navigate('/login')} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full">去登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="我的邀请" />
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Send className="w-3.5 h-3.5 text-blue-500" />
          别人邀请你回答的问题，点击即可查看
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : invites.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-16 text-gray-400 text-sm border border-gray-100">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            暂无邀请
            <div className="text-[11px] text-gray-400 mt-1">被邀请回答的问题会出现在这里</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden border border-gray-100">
            {invites.map((inv) => (
              <button
                key={inv.id}
                onClick={() => navigate(`/question/${inv.question_id}`)}
                className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <Avatar src={inv.inviter_avatar} alt={inv.inviter} className="w-9 h-9 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{inv.inviter}</span>
                    {inv.is_verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5 shrink-0">
                        <BadgeCheck className="w-3 h-3" /> 认证修士
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5 line-clamp-1">
                    邀请你回答：<span className="text-gray-800">{inv.q_title}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {formatTime(new Date(inv.created_at).getTime())}
                  </div>
                </div>
                <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
