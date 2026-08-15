import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Eye,
  MessageSquare,
  Edit3,
  Flag,
  Star,
  Share2,
  School,
  Coins,
  Send,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader, { shareCurrentPage } from '@/components/PageHeader';
import AnswerCard from '@/components/AnswerCard';
import Avatar from '@/components/Avatar';
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import InviteDialog from '@/components/invitedialog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatCount } from '@/utils/format';
import { Seo, qaJsonLd } from '@/components/Seo';

type AnswerSort = 'hot' | 'new';

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useXiuxianStore();

  const [favorited, setFavorited] = useState(false);
  const [loadedAnswers, setLoadedAnswers] = useState<any[]>([]);
  const [answerSort, setAnswerSort] = useState<AnswerSort>('hot');
  const [questionFollowed, setQuestionFollowed] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewImg, setPreviewImg] = useState('');
  const [schoolName, setSchoolName] = useState('');
  // v19：追加悬赏 + 邀请回答
  const [bountyOpen, setBountyOpen] = useState(false);
  const [bountyAmount, setBountyAmount] = useState(10);
  const [bountyBusy, setBountyBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // v28：买热搜
  const [hotOpen, setHotOpen] = useState(false);
  const [hotHours, setHotHours] = useState(24);
  const [hotBusy, setHotBusy] = useState(false);

  const question = id ? store.getQuestionById(id) : undefined;
  const currentUser = store.getCurrentUser();

  usePageTitle(question?.title || '问题详情');

  const seoJson = question
    ? qaJsonLd({
        questionId: question.id,
        title: question.title,
        text: question.content || question.title,
        answerTexts: (loadedAnswers || []).map((a: any) => a.content || '').filter(Boolean).slice(0, 5),
        author: question.nickname,
      })
    : undefined;

  useEffect(() => {
    if (question?.schoolId) {
      store.listSchools().then((list: any[]) => {
        const s = (list || []).find((x: any) => x.id === question.schoolId);
        if (s) setSchoolName(s.name);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.schoolId]);

  useEffect(() => {
    if (question) {
      store.isQuestionFollowed(question.id).then(setQuestionFollowed);
      api.getQuestionFollowerCount(question.id).then(setFollowerCount).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  useEffect(() => {
    if (!question) return;
    // 无论是否登录都增加浏览量并加载回答（旧逻辑把这两步放在登录判断里，导致游客看不到回答）
    store.incrementView(question.id);
    store.loadAnswers(question.id).then(setLoadedAnswers);
    // 记录浏览历史
    store.addViewHistory(question);
    if (!currentUser) return;
    setFavorited(store.isFavorited(currentUser.id, question.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, currentUser?.id]);

  const sortedAnswers = useMemo(() => {
    const list = [...loadedAnswers];
    if (answerSort === 'new') {
      return list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list.sort((a, b) => b.likeCount - a.likeCount);
  }, [loadedAnswers, answerSort]);

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="问题详情" />
        {store.loaded ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400 mb-4">问题不存在或已删除</p>
            <button
              onClick={() => store.refreshQuestions().then(() => {})}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
            >
              重新加载
            </button>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400 text-sm">加载中...</div>
        )}
      </div>
    );
  }

  const requireLogin = (action: () => void) => {
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    action();
  };

  const handleFavorite = () => {
    requireLogin(async () => {
      const newState = await store.toggleFavorite(currentUser!.id, question.id);
      setFavorited(newState);
      toast.success(newState ? '已收藏' : '已取消收藏');
    });
  };



  const handleWriteAnswer = () => {
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    navigate(`/answer/${question.id}`);
  };

  const handleFollowQuestion = async () => {
    requireLogin(async () => {
      const nowFollowed = await store.toggleQuestionFollow(question);
      setQuestionFollowed(nowFollowed);
      const n = await api.getQuestionFollowerCount(question.id).catch(() => 0);
      setFollowerCount(n);
      toast.success(nowFollowed ? '已关注该问题' : '已取消关注该问题');
    });
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
        targetType: 'question',
        targetId: String(question.id),
        targetUserId: String(question.userId),
        reason: '违规内容',
      });
      toast.success('举报已提交，我们会尽快处理');
    } catch (err: any) {
      toast.error(err?.message || '举报提交失败，请重试');
    }
  };

  // v19：追加悬赏（响应慢催更）
  const confirmBounty = async () => {
    if (!bountyAmount || bountyAmount <= 0 || bountyAmount > 100) {
      toast.error('追加金额 1-100 元');
      return;
    }
    setBountyBusy(true);
    try {
      await api.addBountyAmountByQuestion(Number(question.id), bountyAmount);
      toast.success(`已追加悬赏 ¥${bountyAmount}，可加速道友响应`);
      setBountyOpen(false);
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    } finally {
      setBountyBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Seo
        title={question?.title}
        description={(question?.content || question?.title || '').slice(0, 120)}
        keywords={`修仙问答,${question?.title || ''},功法,渡劫,灵根`}
        type="qa"
        canonical={`/question/${question?.id}`}
        jsonLd={seoJson}
        author={question?.nickname}
      />
      <PageHeader title="问题详情" />

      <div className="space-y-0">
        {/* Question header */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          {/* 审核状态提示：匿名内容待审核/未通过时仅作者可见 */}
          {(question as any).status === 'pending' && (
            <div className="mb-3 rounded-xl bg-purple-50 border border-purple-100 px-4 py-2.5 text-xs text-purple-600">
              <span className="font-semibold">⏳ 该匿名内容正在审核中</span>，审核通过后将对所有道友公开。
            </div>
          )}
          {(question as any).status === 'hidden' && (
            <div className="mb-3 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-500">
              <span className="font-semibold">该内容未通过审核</span>，仅作者本人可见（管理员可恢复）。
            </div>
          )}

          {/* Title */}
          <h1 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
            {question.title}
          </h1>

          {/* 学校标签：点击进入该校圈子 */}
          {schoolName && (
            <button
              onClick={() => navigate(`/topic/school/${question.schoolId}`)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2.5 py-1 mb-2 hover:bg-blue-100 transition-colors"
            >
              <School className="w-3.5 h-3.5" />
              {schoolName}
            </button>
          )}

          {/* Content（默认收起，点问题详情展开） */}
          <div
            className={"text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-3 " + (expanded ? "" : "line-clamp-3")}
          >
            {question.content}
          </div>

          {/* 问题详情 + 关注问题 并排各半 */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              {expanded ? "收起问题描述" : "问题详情"}
            </button>
            <button
              onClick={handleFollowQuestion}
              className={"flex-1 h-11 rounded-xl text-sm font-medium transition-colors " + (questionFollowed ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-blue-600 text-white hover:bg-blue-700")}
            >
              {questionFollowed ? "已关注" : "关注问题"}
            </button>
          </div>

          {/* Images */}
          {question.images && question.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {question.images.map((img: string, i: number) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  loading="lazy"
                  onClick={() => setPreviewImg(img)}
                  className="w-full rounded-lg object-cover aspect-video cursor-zoom-in"
                />
              ))}
            </div>
          )}

          {/* Stats: 关注量(纯展示) / 浏览 / 回答 */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Star className={"w-3.5 h-3.5 " + (questionFollowed ? "text-amber-500 fill-current" : "")} />
              <span>{followerCount} 关注</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{formatCount(question.viewCount)} 浏览</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{question.answerCount} 回答</span>
            </div>
          </div>
        </div>

        {/* 操作栏：提问者信息 + 右侧 分享/举报 */}
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-2.5">
          {question.isAnonymous ? (
            <>
              <Avatar src="" alt="匿名道友" className="w-7 h-7" bgClass="bg-gray-400" />
              <span className="text-sm font-medium text-gray-500">匿名道友</span>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border text-purple-600 bg-purple-50 border-purple-200">匿名</span>
            </>
          ) : (
            <>
              <Avatar
                src={(question as any).authorAvatar}
                alt={(question as any).authorName || '道友'}
                className="w-7 h-7"
                bgClass="bg-blue-500"
              />
              <span className="text-sm font-medium text-gray-800 truncate">
                {(question as any).authorName || '匿名道友'}
              </span>
              <button
                onClick={() => navigate(`/user/${question.userId}`)}
                className="shrink-0 h-6 px-2.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                主页
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-4">
            {/* v19：邀请回答（所有登录用户）+ 追加悬赏（仅提问者） */}
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Send className="w-4 h-4" />
              <span>邀请回答</span>
            </button>
            {currentUser && String(currentUser.id) === String(question.userId) && (
              <button
                onClick={() => setBountyOpen(true)}
                className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                <Coins className="w-4 h-4" />
                <span>追加悬赏</span>
              </button>
            )}
            {currentUser && String(currentUser.id) === String(question.userId) && (
              <button
                onClick={() => setHotOpen(true)}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                <Flame className="w-4 h-4" />
                <span>买热搜</span>
              </button>
            )}
            <button
              onClick={handleFavorite}
              className={`flex items-center gap-1 text-sm ${favorited ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}`}
            >
              <Star className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
              <span>{favorited ? '已收藏' : '收藏'}</span>
            </button>
            <button
              onClick={() => shareCurrentPage(question.title)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600"
            >
              <Share2 className="w-4.5 h-4.5" />
              <span>分享</span>
            </button>
            <button
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500"
            >
              <Flag className="w-4 h-4" />
              <span>举报</span>
            </button>
          </div>
        </div>

        {/* Answers section */}
        <div className="mt-3">
          <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              {sortedAnswers.length} 个回答
            </h2>
            <div className="flex gap-1">
              {(['hot', 'new'] as AnswerSort[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAnswerSort(mode)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    answerSort === mode
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {mode === 'hot' ? '按热度' : '按时间'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white">
            {sortedAnswers.map((a) => (
              <AnswerCard key={a.id} answer={a} showFullContent />
            ))}
          </div>

          {sortedAnswers.length === 0 && (
            <div className="bg-white text-center py-16">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
                <Edit3 className="w-7 h-7" />
              </div>
              <p className="text-sm text-gray-400">暂无回答，快来抢首答吧</p>
            </div>
          )}
        </div>
      </div>

      {/* 追加悬赏弹窗（v19：响应慢催更） */}
      <Dialog open={bountyOpen} onOpenChange={setBountyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              追加悬赏
            </DialogTitle>
            <DialogDescription>追加金额后，问题在悬赏榜的赏金同步增加，吸引更多道友回答</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setBountyAmount(amt)}
                className={`h-10 rounded-xl text-sm font-bold border transition-colors ${bountyAmount === amt ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-600 hover:border-amber-300'}`}
              >
                ¥{amt}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={bountyAmount || ''}
            onChange={(e) => setBountyAmount(Number(e.target.value))}
            min={1}
            max={100}
            placeholder="自定义金额（1-100）"
            className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-amber-300"
          />
          <DialogFooter>
            <button onClick={() => setBountyOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={confirmBounty}
              disabled={bountyBusy}
              className="h-9 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-full disabled:opacity-40"
            >
              {bountyBusy ? '处理中...' : `确认追加 ¥${bountyAmount || 0}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 买热搜弹窗（v28：付费上榜首页热搜榜） */}
      <Dialog open={hotOpen} onOpenChange={setHotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              买热搜
            </DialogTitle>
            <DialogDescription>付费加热度，上榜后展示在首页热搜榜（¥10/24小时，余额支付）</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[6, 24, 72, 168].map((h) => (
              <button
                key={h}
                onClick={() => setHotHours(h)}
                className={`h-10 rounded-xl text-sm font-bold border transition-colors ${hotHours === h ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}
              >
                {h}h
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-orange-700 flex items-center justify-between">
            <span>费用</span>
            <span className="text-lg font-bold">¥{hotHours * 10}</span>
          </div>
          <DialogFooter>
            <button onClick={() => setHotOpen(false)} className="h-9 px-6 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">取消</button>
            <button
              onClick={async () => {
                setHotBusy(true);
                try {
                  const { buyHotSearch } = await import('@/lib/features');
                  await buyHotSearch(Number(question.id), hotHours);
                  toast.success(`已购买热搜 ${hotHours} 小时，首页热搜榜可见`);
                  setHotOpen(false);
                } catch (e: any) {
                  toast.error(e?.message || '购买失败');
                } finally {
                  setHotBusy(false);
                }
              }}
              disabled={hotBusy}
              className="h-9 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold rounded-full disabled:opacity-40"
            >
              {hotBusy ? '处理中...' : `确认购买 ¥${hotHours * 10}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 邀请回答弹窗（v19） */}
      <InviteDialog
        questionId={question.id}
        questionSchoolId={(question as any).schoolId ?? null}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      {/* 举报确认 */}
      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>举报这个问题？</AlertDialogTitle>
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

      {/* Bottom write answer bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] bg-white border-t border-gray-100 px-4 py-3 z-40">
        <button
          onClick={handleWriteAnswer}
          className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-full hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all"
        >
          写回答
        </button>
      </div>
      {/* 图片预览（v37 lightbox） */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewImg('')}
        >
          <img
            src={previewImg}
            alt="预览"
            className="max-w-[92%] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImg('')}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white text-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="关闭预览"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
