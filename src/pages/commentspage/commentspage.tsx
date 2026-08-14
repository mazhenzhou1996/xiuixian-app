import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Send, AtSign, Flag, Coins } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import ConsultationDialog from '@/components/consultationdialog';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CommentsPage() {
  const { answerId } = useParams<{ answerId: string }>();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  usePageTitle('评论');

  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (answerId) {
      store.loadComments(answerId).then(setComments);
    }
  }, [answerId, store]);

  const [replyTo, setReplyTo] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [reportTarget, setReportTarget] = useState<any>(null);

  useEffect(() => {
    if (replyTo && inputRef.current) inputRef.current.focus();
  }, [replyTo]);

  // Reload after adding comment
  const reloadComments = async () => {
    if (answerId) {
      const c = await store.loadComments(answerId);
      setComments(c);
    }
  };

  const getReplyComments = (parentId: string) => {
    return comments.filter((c: any) => c.replyTo === parentId);
  };

  const rootComments = comments.filter((c: any) => !c.replyTo);

  const handleSubmit = async () => {
    if (!currentUser) { toast.info('请先登录'); navigate('/login'); return; }
    if (!inputValue.trim()) { toast.error('请输入评论内容'); return; }
    if (!answerId) return;

    await store.addComment({
      answerId,
      userId: currentUser.id,
      content: inputValue.trim(),
      replyTo: replyTo?.id,
      replyToUserId: replyTo?.userId,
    });
    setInputValue('');
    setReplyTo(null);
    toast.success('评论成功');
    await reloadComments();
  };

  const handleLike = async (comment: any) => {
    if (!currentUser) { toast.info('请先登录'); navigate('/login'); return; }
    await store.toggleLike(currentUser.id, 'comment', comment.id);
  };

  const handleReport = async () => {
    const target = reportTarget;
    setReportTarget(null);
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (!target) return;
    try {
      await api.submitReport({
        targetType: 'comment',
        targetId: String(target.id),
        targetUserId: target.userId ? String(target.userId) : undefined,
        reason: '违规内容',
        content: target.content || '',
      });
      toast.success('举报已提交，我们会尽快处理');
    } catch (err: any) {
      toast.error(err?.message || '举报提交失败，请重试');
    }
  };

  const handleReply = (comment: any) => {
    if (!currentUser) { toast.info('请先登录'); navigate('/login'); return; }
    setReplyTo(comment);
    setInputValue(`@${comment.authorName ?? ''} `);
  };

  const cancelReply = () => { setReplyTo(null); setInputValue(''); };

  // 付费咨询弹窗(对评论作者)
  const [consultTarget, setConsultTarget] = useState<any>(null);

  if (!answerId) {
    return <div className="min-h-screen bg-gray-50"><PageHeader title="评论" /><div className="text-center py-20 text-gray-400 text-sm">回答不存在</div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex flex-col">
      <PageHeader title={`${comments.length} 条评论`} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-4">
          {rootComments.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-sm">暂无评论，快来发表第一条评论吧</div>
          )}
          {rootComments.map((comment: any) => {
            const user = { nickname: comment.authorName, avatar: comment.authorAvatar, realm: comment.authorRealm };
            const isLiked = currentUser ? store.isLiked(currentUser.id, 'comment', comment.id) : false;
            const replies = getReplyComments(comment.id);
            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar
                  src={user.avatar}
                  alt={user.nickname}
                  className="w-8 h-8"
                  bgClass="bg-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">{user.nickname}</span>
                    {user.realm && <span className="text-[10px] px-1.5 py-0.5 rounded border text-gray-500 bg-gray-50">{user.realm}</span>}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">{comment.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{formatTime(comment.createdAt)}</span>
                    <button onClick={() => handleReply(comment)} className="hover:text-blue-600 flex items-center gap-1"><AtSign className="w-3.5 h-3.5" />回复</button>
                    <button onClick={() => setReportTarget(comment)} className="hover:text-red-500 flex items-center gap-1"><Flag className="w-3.5 h-3.5" />举报</button>
                    <button
                      onClick={() => setConsultTarget(comment)}
                      className="flex items-center gap-1 px-2.5 h-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white font-medium shadow-sm shadow-orange-100"
                    >
                      <Coins className="w-3 h-3" />付费咨询
                    </button>
                    <button onClick={() => handleLike(comment)} className={`ml-auto flex items-center gap-1 ${isLiked ? 'text-blue-600' : 'hover:text-blue-500'}`}>
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} /><span>{comment.likeCount}</span>
                    </button>
                  </div>
                  {/* 楼层提示：双方回复超过三层 */}
                  {replies.length >= 3 && (
                    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-600">
                      双方回复已超过三楼，如需深入交流，可向{user.nickname || '对方'}
                      <button onClick={() => setConsultTarget(comment)} className="underline font-medium mx-0.5">付费咨询</button>
                      · 对当前评论感兴趣也可直接咨询
                    </div>
                  )}
                  {replies.length > 0 && (
                    <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-3">
                      {replies.slice(0, 3).map((reply: any) => (
                        <div key={reply.id}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium text-gray-700">{reply.authorName}</span>
                            {reply.replyToUserId && <><span className="text-xs text-gray-400">回复</span><span className="text-xs font-medium text-blue-600">{'用户'}</span></>}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed mb-1">{reply.content}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>{formatTime(reply.createdAt)}</span>
                            <button onClick={() => handleLike(reply)} className={`ml-auto flex items-center gap-1 ${store.isLiked(currentUser?.id || '', 'comment', reply.id) ? 'text-blue-600' : 'hover:text-blue-500'}`}>
                              <Heart className="w-3 h-3" /><span>{reply.likeCount}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] bg-white border-t border-gray-100 p-3 z-40">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>回复 @{replyTo.authorName ?? ''}</span>
            <button onClick={cancelReply} className="text-blue-600">取消</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="说点什么..." rows={1}
            className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
            style={{ maxHeight: '80px' }} />
          <button onClick={handleSubmit} disabled={!inputValue.trim()}
            className="h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-full disabled:opacity-50 flex items-center gap-1">
            <Send className="w-4 h-4" />发送
          </button>
        </div>
      </div>
      {/* 付费咨询弹窗(评论作者) */}
      {consultTarget && (
        <ConsultationDialog
          expertId={consultTarget.userId ? String(consultTarget.userId) : ''}
          expertName={consultTarget.authorName || '对方'}
          onClose={() => setConsultTarget(null)}
        />
      )}

      {/* 举报确认 */}
      <AlertDialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>举报这条评论？</AlertDialogTitle>
            <AlertDialogDescription>
              提交后我们会尽快审核处理（违规内容、广告、人身攻击等）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport} className="bg-red-500 hover:bg-red-600 text-white">
              提交举报
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
