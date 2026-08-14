import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, MessageSquare, Star, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime, REALM_LABELS, REALM_COLORS } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

type Tab = 'questions' | 'answers' | 'people';

export default function FollowPage() {
  usePageTitle('关注');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [answerUpdates, setAnswerUpdates] = useState<Record<string, boolean>>({});
  const [peopleUpdates, setPeopleUpdates] = useState<Record<string, number>>({});
  const [followedQuestions, setFollowedQuestions] = useState<any[]>([]);
  const [followedAnswers, setFollowedAnswers] = useState<any[]>([]);

  const allQuestions = store.getQuestions();

  useEffect(() => {
    if (!currentUser) return;
    store.getFollowedQuestions().then(setFollowedQuestions);
    store.getFollowedAnswers().then(setFollowedAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      // 关注的人
      const ids = await store.getMyFollowing();
      const all = store.getUsers();
      setFollowingUsers(ids
        .map((id: string) => all.find((u: any) => String(u.id) === String(id)))
        .filter(Boolean));

      // 关注的问题：对比回答数，有新增标记
      const updates: Record<string, boolean> = {};
      for (const q of followedQuestions) {
        const cur = allQuestions.find((x: any) => String(x.id) === String(q.id));
        if (cur && (q.lastAnswerCount === undefined || Number(cur.answerCount) > Number(q.lastAnswerCount))) {
          updates[q.id] = true;
        }
      }
      setAnswerUpdates(updates);

      // 关注的人新动态：新问题 / 新回答（对比检查时间）
      const checkTime = store.getFolloweeCheckTime();
      const pUpdates: Record<string, number> = {};
      if (checkTime > 0) {
        for (const u of ids) {
          let n = 0;
          // 新问题
          n += allQuestions.filter(
            (q: any) => String(q.userId) === String(u) && new Date(q.createdAt).getTime() > checkTime
          ).length;
          // 新回答
          try {
            const ans = await store.getUserAnswers(String(u));
            n += ans.filter((a: any) => new Date(a.createdAt).getTime() > checkTime).length;
          } catch { /* ignore */ }
          if (n > 0) pUpdates[String(u)] = n;
        }
      }
      setPeopleUpdates(pUpdates);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, followedQuestions]);

  // 关注回答：对比点赞数，有变化标记
  useEffect(() => {
    const check = async () => {
      const updates: Record<string, boolean> = {};
      for (const a of followedAnswers) {
        try {
          const answers = await store.loadAnswers(a.questionId);
          const cur = answers.find((x: any) => String(x.id) === String(a.id));
          if (cur && (a.lastLikeCount === undefined || Number(cur.likeCount) > Number(a.lastLikeCount))) {
            updates[a.id] = true;
          }
        } catch { /* ignore */ }
      }
      setAnswerUpdates((prev) => ({ ...prev, ...updates }));
    };
    if (currentUser) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, followedAnswers]);

  const markQuestionSeen = async (qid: string) => {
    const cur = allQuestions.find((x: any) => String(x.id) === String(qid));
    await store.markQuestionChecked(qid, cur ? Number(cur.answerCount) : 0);
    setAnswerUpdates((prev) => ({ ...prev, [qid]: false }));
    navigate(`/question/${qid}`);
  };

  const markAnswerSeen = async (a: any) => {
    await store.markAnswerChecked(a.id, 0);
    setAnswerUpdates((prev) => ({ ...prev, [a.id]: false }));
    navigate(`/question/${a.questionId}`);
  };

  const markPeopleSeen = () => {
    store.markFolloweeChecked();
    setPeopleUpdates({});
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="关注" showBack={false} />
        <div className="text-center py-20">
          <p className="text-sm text-gray-400 mb-4">登录后查看关注内容</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  const totalUpdates = Object.values(answerUpdates).filter(Boolean).length
    + Object.values(peopleUpdates).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="关注"
        showBack={false}
        rightAction={
          totalUpdates > 0 ? (
            <button onClick={markPeopleSeen} className="text-xs text-blue-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              标记已读
            </button>
          ) : undefined
        }
      />

      {/* 三页签 */}
      <div className="sticky top-12 z-30 bg-gray-50 px-4 pt-2">
        <div className="bg-white rounded-lg p-1 flex">
          {([
            { key: 'questions', label: '关注问题' },
            { key: 'answers', label: '关注回答' },
            { key: 'people', label: '关注人' },
          ] as { key: Tab; label: string }[]).map((t) => {
            const badge =
              t.key === 'questions'
                ? Object.values(answerUpdates).filter(Boolean).length
                : t.key === 'people'
                ? Object.values(peopleUpdates).reduce((s, n) => s + n, 0)
                : 0;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                {t.label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 关注问题 */}
      {activeTab === 'questions' && (
        <div className="pt-2 pb-4">
          {followedQuestions.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              还没有关注的问题，详情页点「关注问题」即可
            </div>
          ) : (
            <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
              {followedQuestions.map((q) => {
                const hasNew = !!answerUpdates[q.id];
                const cur = allQuestions.find((x: any) => String(x.id) === String(q.id));
                return (
                  <div
                    key={q.id}
                    onClick={() => markQuestionSeen(q.id)}
                    className="relative px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {hasNew && (
                      <span className="absolute top-2.5 right-3 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                        有新回答
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-1 pr-16">
                      <FileQuestion className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-sm text-gray-800 line-clamp-1">{q.title}</span>
                    </div>
                    <div className="text-xs text-gray-400 pl-6 flex items-center gap-3">
                      <span>关注于 {formatTime(q.time)}</span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3" />
                        {cur ? Number(cur.answerCount) : (q.lastAnswerCount ?? 0)} 回答
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 关注回答 */}
      {activeTab === 'answers' && (
        <div className="pt-2 pb-4">
          {followedAnswers.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              还没有关注的回答，回答卡片点「关注回答」即可
            </div>
          ) : (
            <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
              {followedAnswers.map((a) => {
                const hasNew = !!answerUpdates[a.id];
                return (
                  <div
                    key={a.id}
                    onClick={() => markAnswerSeen(a)}
                    className="relative px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {hasNew && (
                      <span className="absolute top-2.5 right-3 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                        有更新
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-1 pr-16">
                      <Star className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-sm text-gray-800 line-clamp-2">{a.content}</span>
                    </div>
                    <div className="text-xs text-gray-400 pl-6">
                      关注于 {formatTime(a.time)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 关注人 */}
      {activeTab === 'people' && (
        <div className="px-4 py-3">
          {followingUsers.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              还没有关注的道友，去排行榜逛逛吧
            </div>
          ) : (
            <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
              {followingUsers.map((u) => {
                const updates = peopleUpdates[String(u.id)] || 0;
                return (
                  <div key={u.id} className="relative flex items-center gap-3 p-3.5">
                    {updates > 0 && (
                      <span className="absolute top-2.5 right-3 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                        {updates} 条新动态
                      </span>
                    )}
                    <Avatar src={u.avatar} alt={u.nickname} className="w-10 h-10" />
                    <div className="flex-1 min-w-0 pr-20">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">{u.nickname}</span>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${REALM_COLORS[u.realm as keyof typeof REALM_COLORS] || 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                          {REALM_LABELS[u.realm as keyof typeof REALM_LABELS] || u.realm}
                        </span>
                      </div>
                      {u.bio && <div className="text-xs text-gray-400 truncate mt-0.5">{u.bio}</div>}
                    </div>
                    <button
                      onClick={markPeopleSeen}
                      className="shrink-0 h-7 px-3 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      查看动态
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
