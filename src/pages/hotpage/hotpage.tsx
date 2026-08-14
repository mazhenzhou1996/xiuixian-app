import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { formatCount } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';
import { Skeleton } from '@/components/ui/skeleton';

export default function HotPage() {
  usePageTitle('热榜');
  const store = useXiuxianStore();
  const questions = store.getQuestions();
  const loaded = store.loaded;
  const [sortMode, setSortMode] = useState<'hot' | 'new'>('hot');

  // 热榜页按 hot_score 排序，且切换「最新」时按时间排序
  const hotList = useMemo(() => {
    const list = [...questions];
    if (sortMode === 'new') {
      return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    }
    return list.sort((a, b) => b.hotScore - a.hotScore).slice(0, 20);
  }, [questions, sortMode]);

  const topThree = hotList.slice(0, 3);
  const rest = hotList.slice(3);

  return (
    <div className="py-3 space-y-0">
      <Seo
        title="修仙热榜 - 修仙问答"
        description="修仙界最热门的修炼疑问与渡劫心得，实时热榜，看道友们都在讨论什么。"
        keywords="修仙热榜,热门修仙问题,渡劫,功法排行"
        type="website"
        canonical="/hot"
      />
      {/* Hot header */}
      <div className="px-4 mb-4">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 rounded-lg p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5" />
            <span className="text-base font-bold">{sortMode === 'hot' ? '实时热榜' : '最新问答'}</span>
          </div>
          <p className="text-xs text-white/80">
            {sortMode === 'hot' ? '综合点赞、评论、浏览热度实时更新' : '按发布时间排序，最新的道法问答'}
          </p>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="px-4 mb-3 flex gap-2">
        {(['hot', 'new'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {mode === 'hot' ? '按热度' : '按最新'}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="bg-white border-t border-b border-gray-100 divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5">
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Top 3 special */}
          {topThree.length > 0 && (
            <div className="bg-white border-t border-b border-gray-100 divide-y divide-gray-100">
              {topThree.map((q, idx) => (
                <div key={q.id} className="relative">
                  <div className="absolute top-3.5 left-4 flex items-center gap-2 z-10">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white ${
                        idx === 0
                          ? 'bg-red-500'
                          : idx === 1
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatCount(q.hotScore)} 热度
                    </span>
                  </div>
                  <div className="pt-8">
                    <QuestionCard question={q} rank={idx + 1} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rest of list */}
          {rest.length > 0 && (
            <div className="bg-white border-b border-gray-100 divide-y divide-gray-100 mt-3">
              {rest.map((q, i) => (
                <QuestionCard key={q.id} question={q} rank={i + 4} showHotBadge />
              ))}
            </div>
          )}

          {hotList.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-sm">
              暂无内容上榜
            </div>
          )}
        </>
      )}
    </div>
  );
}
