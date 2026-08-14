import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function MyAnswersPage() {
  usePageTitle('我的回答');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [myAnswers, setMyAnswers] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    store.loadUserAnswers(currentUser.id).then(setMyAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="我的回答" />
        <div className="text-center py-20 text-gray-400 text-sm">
          登录后查看我的回答
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="我的回答" />
      {myAnswers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          还没有回答，去回答一个问题吧
        </div>
      ) : (
        <div className="space-y-0 bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
          {myAnswers.map((a) => {
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
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>👍 {a.likeCount}</span>
                  <span>💬 {a.commentCount} 评论</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
