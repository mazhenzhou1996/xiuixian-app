import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, ThumbsUp, PenLine, Coins } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import QuestionCard from '@/components/QuestionCard';
import Avatar from '@/components/Avatar';
import ConsultationDialog from '@/components/consultationdialog';
import { useXiuxianStore } from '@/store/useStore';
import { formatCount, formatTime, REALM_LABELS } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';

type Tab = 'questions' | 'answers';

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  usePageTitle('道友主页');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [consultOpen, setConsultOpen] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [hideContent, setHideContent] = useState(false);

  const user = id ? store.getUserById(id) : null;
  const currentUser = store.getCurrentUser();
  const isSelf = !!currentUser && !!user && String(currentUser.id) === String(user.id);

  useEffect(() => {
    if (!id) return;
    store.getFollowers(id).then(setFollowerCount);
    store.getFollowing(id).then(setFollowingCount);
    store.loadUserAnswers(id).then(setAnswers);
    // 目标用户是否隐藏了主页内容（本人不受影响）
    if (!isSelf) {
      import('@/lib/api').then(({ api }) => api.getUserHideContent(id).then(setHideContent).catch(() => {}));
    } else {
      setHideContent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSelf]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="道友主页" />
        <div className="text-center py-20 text-gray-400 text-sm">用户不存在</div>
      </div>
    );
  }

  const myQuestions = store.getQuestions().filter((q) => String(q.userId) === String(user.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo
        title={user?.nickname ? `${user.nickname} 的主页 - 修仙问答` : '道友主页'}
        description={user?.bio || `${user?.nickname || '道友'}在修仙问答的修仙主页，分享修炼心得与渡劫经验。`}
        keywords={`${user?.nickname || '道友'},修仙问答,修士主页`}
        type="article"
        canonical={`/user/${user?.id}`}
        author={user?.nickname}
      />
      <PageHeader title={user.nickname} />

      {/* 用户信息卡 */}
      <div className="px-4 py-3">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative z-10 flex items-center gap-4">
            <Avatar
              src={user.avatar}
              alt={user.nickname}
              className="w-16 h-16 border-2 border-white/40"
              bgClass="bg-gradient-to-br from-blue-500 to-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold truncate">{user.nickname}</h2>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white">
                  {REALM_LABELS[user.realm as keyof typeof REALM_LABELS] || user.realm}
                </span>
              </div>
              <p className="text-xs text-blue-100 line-clamp-1 mb-2">
                {user.bio || '这位道友很低调，什么都没留下'}
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span><b className="text-base">{formatCount(followerCount)}</b> 关注者</span>
                <span><b className="text-base">{formatCount(followingCount)}</b> 关注了</span>
                <span><b className="text-base">{formatCount(user.points)}</b> 声望</span>
              </div>
              {isSelf && (
                <button
                  onClick={() => navigate('/settings/profile')}
                  className="mt-3 h-8 px-4 rounded-full bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors"
                >
                  编辑资料
                </button>
              )}
              {!isSelf && user && (
                <button
                  onClick={() => setConsultOpen(true)}
                  className="mt-3 h-8 px-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold shadow-md shadow-orange-200 hover:from-amber-500 hover:to-orange-500 transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> 付费咨询
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 付费咨询弹窗 */}
      {consultOpen && user && (
        <ConsultationDialog expertId={user.id} expertName={user.nickname} onClose={() => setConsultOpen(false)} />
      )}

      {/* Tab */}
      <div className="px-4 sticky top-12 z-20 bg-gray-50 pt-1 pb-2">
        {hideContent && !isSelf ? (
          <div className="bg-white rounded-xl px-4 py-8 text-center">
            <div className="text-2xl mb-2">🙈</div>
            <div className="text-sm text-gray-500 mb-1">该道友已隐藏主页内容</div>
            <div className="text-xs text-gray-400">TA 的提问和回答暂不公开</div>
          </div>
        ) : (
        <div className="bg-white rounded-lg p-1 flex">
          {([
            { key: 'questions', label: `提问 ${myQuestions.length}` },
            { key: 'answers', label: `回答 ${answers.length}` },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* 提问列表 */}
      {activeTab === 'questions' && (
        myQuestions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">还没有提问</div>
        ) : (
          <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
            {myQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )
      )}

      {/* 回答列表 */}
      {activeTab === 'answers' && (
        answers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">还没有回答</div>
        ) : (
          <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
            {answers.map((a) => {
              const q = store.getQuestionById(a.questionId);
              return (
                <div
                  key={a.id}
                  onClick={() => navigate(`/question/${a.questionId}`)}
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {q && (
                    <div className="text-sm font-semibold text-gray-800 mb-1.5 line-clamp-1 flex items-center gap-1.5">
                      <PenLine className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {q.title}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{a.content}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{a.likeCount}</span>
                    <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{a.commentCount}</span>
                    <span>{formatTime(a.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
