import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Search, Trophy, Users, Loader2, BadgeCheck, School } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useXiuxianStore } from '@/store/useStore';
import Avatar from '@/components/Avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface InviteDialogProps {
  questionId: string | number;
  questionSchoolId?: number | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 邀请回答弹窗（v19）
 * ① 邀请本校认证修士（批量）② 邀请指定用户 ③ 转全网悬赏
 */
export default function InviteDialog({ questionId, questionSchoolId, open, onClose }: InviteDialogProps) {
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [school, setSchool] = useState<any>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [inviting, setInviting] = useState(false);

  // 指定用户
  const [keyword, setKeyword] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 目标学校：优先问题学校标签，其次用户已绑定学校
    const sid = questionSchoolId || (store.getSelectedSchool() as any)?.id;
    if (sid) {
      store.listSchools().then((list: any[]) => {
        const s = (list || []).find((x: any) => x.id === sid);
        if (s) setSchool(s);
      }).catch(() => {});
      api.listVerifiedMembers(Number(sid), 50).then((list: any[]) => setVerifiedCount(list?.length || 0)).catch(() => {});
    } else {
      setSchool(null);
      setVerifiedCount(0);
    }
    setKeyword('');
    setUserResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionSchoolId]);

  const inviteVerified = async () => {
    if (!school) { toast.info('该问题未关联学校，无法批量邀请认证修士'); return; }
    setInviting(true);
    try {
      const res = await api.inviteVerifiedMembers(Number(questionId), school.id);
      toast.success(`已向 ${res?.invited || 0} 位本校认证修士发送邀请`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '邀请失败');
    } finally {
      setInviting(false);
    }
  };

  const searchUsers = async () => {
    if (!keyword.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchUsers(keyword.trim());
      setUserResults(res || []);
    } catch {
      setUserResults([]);
    } finally {
      setSearching(false);
    }
  };

  const inviteUser = async (u: any) => {
    setInviting(true);
    try {
      await api.inviteUser(Number(questionId), String(u.id));
      toast.success(`已邀请 ${u.nickname}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '邀请失败');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Send className="w-4 h-4 text-blue-500" />
            邀请回答
          </DialogTitle>
          <DialogDescription>邀请道友解答你的问题，或转为悬赏加速响应</DialogDescription>
        </DialogHeader>

        {/* ① 邀请本校认证修士 */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <Users className="w-4 h-4 text-emerald-500" />
              邀请本校认证修士
            </div>
            {school && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                <School className="w-3 h-3" /> {school.name} · {verifiedCount} 位认证修士
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
            批量邀请该校认证修士回答（认证修士 = 后台审核过的本校修士）
          </p>
          <button
            onClick={inviteVerified}
            disabled={inviting || !school || verifiedCount === 0}
            className="mt-2.5 h-9 px-4 rounded-full bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-40 flex items-center gap-1"
          >
            {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
            {school ? `邀请全部认证修士（${verifiedCount}）` : '问题未关联学校'}
          </button>
        </div>

        {/* ② 邀请指定用户 */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 mb-2">
            <Search className="w-4 h-4 text-blue-500" />
            邀请指定用户
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              placeholder="搜索道友昵称"
              className="flex-1 h-9 rounded-lg bg-white border border-gray-200 px-3 text-sm outline-none focus:border-blue-300"
            />
            <button onClick={searchUsers} disabled={searching} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-50">
              {searching ? '搜索中' : '搜索'}
            </button>
          </div>
          {userResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {userResults.map((u: any) => (
                <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-white hover:bg-blue-50 transition-colors">
                  <Avatar src={u.avatar} alt={u.nickname} className="w-7 h-7" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 truncate">{u.nickname}</span>
                    {u.school_verified && (
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 inline ml-1" />
                    )}
                  </div>
                  <button
                    onClick={() => inviteUser(u)}
                    disabled={inviting}
                    className="shrink-0 h-7 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-40"
                  >
                    邀请
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ③ 转全网悬赏 */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <Trophy className="w-4 h-4 text-amber-500" />
              转全网悬赏
            </div>
            <span className="text-[11px] text-gray-400">悬赏榜接取 · 最佳答案 70% 分红</span>
          </div>
          <button
            onClick={() => { onClose(); navigate(`/bounty?q=${questionId}`); }}
            className="mt-2.5 h-9 px-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold hover:brightness-105"
          >
            去悬赏榜发布
          </button>
        </div>

        <DialogFooter>
          <button onClick={onClose} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">关闭</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
