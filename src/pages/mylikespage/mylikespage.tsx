import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function MyLikesPage() {
  usePageTitle('我的点赞');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();

  const likedQuestions = useMemo(() => {
    if (!currentUser) return [];
    const targets = store.getLikedTargets().filter((t) => t.targetType === 'question');
    const questions = store.getQuestions();
    return targets
      .map((t) => questions.find((q) => q.id === String(t.targetId)))
      .filter(Boolean);
  }, [store, currentUser]);

  // 赞过的回答（从已加载的缓存匹配）
  const likedAnswers = useMemo(() => {
    if (!currentUser) return [];
    const targets = store.getLikedTargets().filter((t) => t.targetType === 'answer');
    const all = store.getAnswers();
    return targets
      .map((t) => all.find((a) => a.id === String(t.targetId)))
      .filter(Boolean);
  }, [store, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的点赞" />
        <div className="text-center py-20 text-gray-400 text-sm">
          登录后查看我的点赞
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      <PageHeader title="我的点赞" />
      {likedQuestions.length === 0 && likedAnswers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          还没有点赞，遇到好内容点个赞吧
        </div>
      ) : (
        <>
          {likedQuestions.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs text-gray-400">赞过的问题</div>
              <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
                {likedQuestions.map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            </div>
          )}
          {likedAnswers.length > 0 && (
            <div className="mt-3">
              <div className="px-4 py-2 text-xs text-gray-400">赞过的回答</div>
              <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
                {likedAnswers.map((a) => {
                  const q = store.getQuestionById(a.questionId);
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/question/${a.questionId}`)}
                      className="px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      {q && (
                        <div className="text-sm font-semibold text-gray-800 mb-1.5 line-clamp-1">
                          {q.title}
                        </div>
                      )}
                      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                        {a.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
