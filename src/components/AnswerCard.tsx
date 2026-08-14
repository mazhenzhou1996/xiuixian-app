import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ThumbsUp, ThumbsDown, UserPlus, UserCheck, MoreHorizontal, Share2, Flag, Star, Coins, Users } from 'lucide-react';
import type { IAnswer } from '@/data/types';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { formatTime, REALM_LABELS, REALM_COLORS } from '@/utils/format';
import { toast } from 'sonner';
import Avatar from '@/components/Avatar';
import { shareCurrentPage } from '@/components/PageHeader';
import ConsultationDialog from '@/components/consultationdialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface AnswerCardProps {
  answer: IAnswer;
  questionId?: string;
  showFullContent?: boolean;
}

export default function AnswerCard({ answer, showFullContent = false }: AnswerCardProps) {
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const author = (answer as any).authorName ? { nickname: (answer as any).authorName, avatar: (answer as any).authorAvatar, realm: (answer as any).authorRealm, userId: (answer as any).userId } : null;
  const currentUser = store.getCurrentUser();
  const liked = currentUser ? store.isLiked(currentUser.id, 'answer', answer.id) : false;
  const [likeCount, setLikeCount] = useState(answer.likeCount || 0);
  const [favorited, setFavorited] = useState(false);
  const [following, setFollowing] = useState(
    () => !!currentUser && !!author && store.isFollowing(currentUser.id, author.userId)
  );
  const [disliked, setDisliked] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [consultSetting, setConsultSetting] = useState<any>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(5);
  const [tipping, setTipping] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [likers, setLikers] = useState<any[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);

  useEffect(() => {
    if (author?.userId) {
      api.getConsultationSetting(String(author.userId)).then(setConsultSetting).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author?.userId]);

  useEffect(() => {
    store.isAnswerFollowed(answer.id).then(setFavorited);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    try {
      const nowLiked = await store.toggleLike(currentUser.id, 'answer', answer.id);
      setLikeCount((c) => Math.max(0, c + (nowLiked ? 1 : -1)));
    } catch (err: any) {
      toast.error(err?.message || '操作失败，请重试');
    }
  };

  const handleDislike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisliked((v) => !v);
    toast.success(disliked ? '已取消点踩' : '已点踩，我们会优化回答排序');
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/comments/${answer.id}`);
  };

  const handleFavoriteAnswer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    try {
      const nowFav = await store.toggleAnswerFollow(answer);
      setFavorited(nowFav);
      toast.success(nowFav ? '已关注该回答' : '已取消关注');
    } catch (err: any) {
      toast.error(err?.message || '操作失败，请重试');
    }
  };

  const handleReport = async () => {
    setReportOpen(false);
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    try {
      await api.submitReport({
        targetType: 'answer',
        targetId: String(answer.id),
        targetUserId: author ? String(author.userId) : undefined,
        reason: '违规内容',
      });
      toast.success('举报已提交，我们会尽快处理');
    } catch (err: any) {
      toast.error(err?.message || '举报提交失败，请重试');
    }
  };

  const handleFollowAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (!author) return;
    if (String(currentUser.id) === String(author.userId)) {
      toast.info('不能关注自己');
      return;
    }
    store.toggleFollow(currentUser.id, author.userId).then((now) => {
      setFollowing(now);
      toast.success(now ? '已关注' : '已取消关注');
    });
  };

  // 赞同者列表：仅答主/管理员可见（服务端也校验）
  const handleShowLikers = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    const isOwner = author && String(currentUser.id) === String(author.userId);
    if (!isOwner && !currentUser.isAdmin) {
      toast.info('赞同者列表仅内容作者可见');
      return;
    }
    setLikersOpen(true);
    setLikersLoading(true);
    try {
      const list = await store.getLikers('answer', Number(answer.id));
      setLikers(list || []);
    } catch (err: any) {
      toast.error(err?.message || '加载失败');
      setLikersOpen(false);
    } finally {
      setLikersLoading(false);
    }
  };

  // 赞赏（感谢=打赏，余额支付）
  const handleTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (author && String(currentUser.id) === String(author.userId)) {
      toast.info('不能赞赏自己的回答');
      return;
    }
    setTipOpen(true);
    setTipAmount(5);
  };

  const confirmTip = async () => {
    if (!tipAmount || tipAmount <= 0) {
      toast.error('请输入赞赏金额');
      return;
    }
    if (tipAmount > 100) {
      toast.error('单笔赞赏最高 100 元');
      return;
    }
    setTipping(true);
    try {
      await store.createTip(Number(answer.id), tipAmount);
      setTipOpen(false);
      toast.success(`已赞赏 ¥${tipAmount}，感谢你的心意`);
    } catch (err: any) {
      toast.error(err?.message || '赞赏失败');
    } finally {
      setTipping(false);
    }
  };

  return (
    <div className="bg-white py-4 border-b border-gray-100 last:border-b-0">
      {/* Author */}
      <div className="flex items-center gap-2.5 mb-2 px-4">
        {(answer as any).isAnonymous ? (
          <>
            <Avatar src="" alt="匿名道友" className="w-9 h-9" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-500">匿名道友</span>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border text-purple-600 bg-purple-50 border-purple-200">匿名</span>
              </div>
              <div className="text-xs text-gray-400">{formatTime(answer.createdAt)}</div>
            </div>
            <span className="shrink-0 text-[10px] text-gray-400">身份已隐藏</span>
          </>
        ) : (
        author && (
          <>
            <Avatar
              src={author.avatar}
              alt={author.nickname}
              className="w-9 h-9"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800 truncate">
                  {author.nickname}
                </span>
                {author.realm && (
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${REALM_COLORS[author.realm as keyof typeof REALM_COLORS] || 'text-gray-600 bg-gray-100 border-gray-200'}`}
                  >
                    {REALM_LABELS[author.realm as keyof typeof REALM_LABELS] || author.realm}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">{formatTime(answer.createdAt)}</div>
            </div>
            {/* 主页 / 私信 / 关注作者 */}
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${author.userId}`); }}
              className="shrink-0 h-7 px-3 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              主页
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/messages/private/${author.userId}`); }}
              className="shrink-0 h-7 px-3 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              私信
            </button>
            <button
              onClick={handleFollowAuthor}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                following
                  ? 'bg-gray-100 text-gray-500 border border-gray-200'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {following ? (
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  已关注
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" />
                  关注
                </span>
              )}
            </button>
          </>
        )
        )}
      </div>

      {/* 赞同数据行 */}
      <div className="px-4 mb-2">
        <button
          onClick={handleShowLikers}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 rounded-full px-2.5 py-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
          {likeCount} 人赞同了该回答
        </button>
        {(answer as any).tipAmount > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
            <Coins className="w-3.5 h-3.5" />
            收到 {(answer as any).tipCount || 0} 笔赞赏 ¥{(answer as any).tipAmount || 0}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4">
        <div
          className={`text-sm text-gray-800 leading-relaxed whitespace-pre-line ${
            showFullContent ? '' : 'line-clamp-4'
          } mb-3`}
        >
          {answer.content}
        </div>

        {/* 向答主付费咨询（真实接通：答主开通后显示，价格取自咨询设置） */}
        {consultSetting && consultSetting.enabled && consultSetting.price > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setPayOpen(true); }}
            className="mb-3 w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold tracking-wide shadow-md shadow-orange-200 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <span className="text-base">💰</span>
            向答主付费咨询 · ¥{consultSetting.price}
          </button>
        ) : (
          <button
            disabled
            className="mb-3 w-full h-12 rounded-xl bg-gray-100 text-gray-400 text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <span className="text-base">💰</span>
            答主暂未开通付费咨询
          </button>
        )}

        {/* Actions: 点赞 / 点踩 / 收藏回答 / 评论 */}
        <div className="flex items-center gap-6 pb-1">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              liked ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span>{likeCount > 0 ? likeCount : '赞同'}</span>
          </button>
          <button
            onClick={handleDislike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              disliked ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ThumbsDown className={`w-4 h-4 ${disliked ? 'fill-current' : ''}`} />
            <span>点踩</span>
          </button>
          <button
            onClick={handleFavoriteAnswer}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              favorited ? 'text-amber-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Star className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
            <span>{favorited ? '已关注' : '关注回答'}</span>
          </button>
          <button
            onClick={handleComment}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{answer.commentCount > 0 ? `${answer.commentCount} 条评论` : '评论'}</span>
          </button>
          <button
            onClick={handleTip}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-600 transition-colors"
          >
            <Coins className="w-4 h-4" />
            <span>赞赏</span>
          </button>

          {/* 更多：分享 / 举报 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center text-gray-400 hover:text-gray-600 transition-colors" aria-label="更多操作">
                <MoreHorizontal className="w-4.5 h-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => shareCurrentPage(`回答 - ${author?.nickname || ''}`)}
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                分享
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-2 text-red-500"
              >
                <Flag className="w-4 h-4" />
                举报
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 举报确认 */}
      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>举报这条回答？</AlertDialogTitle>
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

      {/* 付费咨询弹窗（真实接通） */}
      {payOpen && author && (
        <ConsultationDialog
          expertId={String(author.userId)}
          expertName={author.nickname}
          onClose={() => setPayOpen(false)}
        />
      )}

      {/* 赞赏弹窗（感谢=打赏，余额支付） */}
      <Dialog open={tipOpen} onOpenChange={setTipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              赞赏答主
            </DialogTitle>
            <DialogDescription>感谢优质回答，使用余额支付（可在「我的」查看余额）</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setTipAmount(amt)}
                className={`h-10 rounded-xl text-sm font-bold border transition-colors ${tipAmount === amt ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}
              >
                ¥{amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={tipAmount || ''}
            onChange={(e) => setTipAmount(Number(e.target.value))}
            min={1}
            max={100}
            placeholder="自定义金额（1-100）"
            className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-amber-300"
          />
          <DialogFooter>
            <button onClick={() => setTipOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={confirmTip}
              disabled={tipping}
              className="h-9 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-full disabled:opacity-40"
            >
              {tipping ? '支付中...' : `确认赞赏 ¥${tipAmount || 0}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 赞同者列表（仅内容作者/管理员可见） */}
      <Dialog open={likersOpen} onOpenChange={setLikersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-500" />
              赞同者列表（{likers.length}）
            </DialogTitle>
            <DialogDescription>仅内容作者可见</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {likersLoading ? (
              <div className="text-center py-8 text-xs text-gray-400">加载中...</div>
            ) : likers.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">还没有人赞同</div>
            ) : (
              likers.map((u: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                  <Avatar src={u.avatar} alt={u.nickname} className="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 truncate">{u.nickname}</div>
                    <div className="text-xs text-gray-400">{REALM_LABELS[u.realm as keyof typeof REALM_LABELS] || u.realm || '散修'}</div>
                  </div>
                  {u.points > 0 && <span className="text-xs text-gray-400">{u.points} 声望</span>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
