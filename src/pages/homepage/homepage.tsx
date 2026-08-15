import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '@/components/QuestionCard';
import { useXiuxianStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, BookMarked, School, Sparkles, Users, ChevronRight, PackageSearch, Crown, Heart, Flame, Trophy } from 'lucide-react';

const TOPICS = [
  {
    key: 'university',
    title: '大学专题',
    desc: '学长学姐分享',
    icon: GraduationCap,
    gradient: 'from-blue-600 to-indigo-500',
  },
  {
    key: 'graduate',
    title: '研究生专题',
    desc: '考研择校 · 复试辅导',
    icon: BookMarked,
    gradient: 'from-purple-600 to-violet-500',
  },
];

function HomeSkeleton() {
  return (
    <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3.5">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-2/3 mb-3" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  usePageTitle();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const questions = store.getQuestions();
  const loaded = store.loaded;
  const [schoolFeed, setSchoolFeed] = useState<any[]>([]);
  const [followFeed, setFollowFeed] = useState<any[]>([]);
  const [mySchool, setMySchool] = useState<any>(null);
  // v28：热搜榜
  const [hotSearch, setHotSearch] = useState<any[]>([]);

  useEffect(() => {
    import('@/lib/features').then(({ listHotSearch }) => listHotSearch(10).then(setHotSearch).catch(() => {})).catch(() => {});
  }, []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreAvailable, setMoreAvailable] = useState(true);

  // 加载本校热门 + 关注动态（个性化推流）
  useEffect(() => {
    const s = store.getSelectedSchool();
    if (s?.id) {
      setMySchool(s);
      store.getSchoolFeed(s.id, 0, 6).then(setSchoolFeed).catch(() => {});
    }
    if (store.getCurrentUser()) {
      store.getFollowFeed(0, 5).then(setFollowFeed).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommended = useMemo(() => {
    const now = Date.now();
    const personalized = store.prefs.enablePersonalized;
    const mySchoolId = mySchool?.id;
    const followAuthors = new Set(followFeed.map((f: any) => String(f.author)));
    return [...questions]
      .map((q) => {
        const age = Math.max(0, 1000 - (now - new Date(q.createdAt).getTime()) / (60 * 60 * 1000)) * 5;
        let boost = 0;
        if (personalized) {
          // 个性化加权：本校问题 + 关注的人的问题 优先展示
          if (mySchoolId && q.schoolId === mySchoolId) boost += 200;
          if (followAuthors.has(q.authorName)) boost += 150;
        }
        return { ...q, score: q.hotScore + age + boost };
      })
      .sort((a, b) => b.score - a.score);
  }, [questions, store.prefs.enablePersonalized, mySchool?.id, followFeed]);

  // Preload answers for first 3 questions
  useEffect(() => {
    recommended.slice(0, 3).forEach(q => store.loadAnswers(q.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended.length > 0 && recommended[0]?.id]);

  return (
    <div className="space-y-0 pt-2 pb-4">
      <Seo
        title="修仙问答 - 高校学子专属的修仙主题问答社区"
        description="考研择校、四六级、考公考编、求职面试、宿舍生活、挂科逆袭——修仙问答是下沉高校学子提问学长学姐的修仙主题问答社区。同道共修，答疑解惑。"
        keywords="高校问答,大学问答,考研,四六级,考公,求职,简历,宿舍,挂科,学长学姐,修仙问答,大学生论坛"
        type="website"
      />
      {/* 专题入口（紧凑） */}
      <div className="px-3 mb-2 grid grid-cols-2 gap-2">
        {TOPICS.map((t) => (
          <div
            key={t.key}
            onClick={() => navigate(`/topic/${t.key}`)}
            className={`bg-gradient-to-br ${t.gradient} rounded-xl p-2.5 text-white relative overflow-hidden cursor-pointer active:scale-[0.97] transition-transform flex flex-col`}
          >
            <div className="absolute -right-3 -top-4 w-12 h-12 rounded-full bg-white/10" />
            <t.icon className="w-5 h-5 mb-1 relative z-10" />
            <div className="text-[12px] font-bold relative z-10 leading-tight">{t.title}</div>
            <div className="text-[9px] text-white/85 mt-0.5 leading-snug line-clamp-2 relative z-10">{t.desc}</div>
          </div>
        ))}
      </div>

      {/* 我的学校圈子入口（独立整行，去掉“进入圈子”字样） */}
      <div className="px-3 mb-3">
        {mySchool ? (
          <div
            onClick={() => navigate(`/topic/school/${mySchool.id}`)}
            className="bg-gradient-to-br from-emerald-600 to-teal-500 rounded-xl px-3.5 py-2.5 text-white relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform flex items-center gap-2"
          >
            <School className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold truncate">{mySchool.name}</div>
              <div className="text-[10px] text-white/85">本校圈子 · 本校热门</div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => navigate('/topic/university')}
            className="bg-gradient-to-br from-emerald-600 to-teal-500 rounded-xl px-3.5 py-2.5 text-white relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform flex items-center gap-2"
          >
            <School className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold">我的学校</div>
              <div className="text-[10px] text-white/85">选择学校进入本校圈子</div>
            </div>
          </div>
        )}
      </div>

      {/* v28：热搜榜（付费加热度上榜） */}
      {hotSearch.length > 0 && (
        <div className="px-4 mb-3">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm font-semibold text-gray-800 border-b border-gray-50">
              <Flame className="w-4 h-4 text-orange-500" />
              热搜榜
              <span className="text-[10px] font-normal text-gray-400 ml-auto">付费加热上榜 · 限时展示</span>
            </div>
            <div className="divide-y divide-gray-50">
              {hotSearch.map((h: any, i: number) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/question/${h.question_id}`)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={`w-5 text-center text-sm font-bold shrink-0 ${i === 0 ? 'text-red-500' : i === 1 ? 'text-orange-500' : i === 2 ? 'text-amber-500' : 'text-gray-300'}`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{h.title}</span>
                  <span className="text-[11px] text-orange-500 shrink-0">🔥 {h.heat}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* v25：悬赏 + 失物招领 + 评选入口 */}
      <div className="px-4 mb-3 grid grid-cols-3 gap-2.5">
        <div
          onClick={() => navigate('/bounty')}
          className="bg-gradient-to-br from-red-600 to-rose-600 rounded-xl p-3 text-white relative overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
        >
          <div className="absolute -right-4 -top-5 w-14 h-14 rounded-full bg-white/10" />
          <Trophy className="w-6 h-6 mb-1.5 relative z-10" />
          <div className="text-[13px] font-bold relative z-10">悬赏榜</div>
          <div className="text-[10px] text-white/85 mt-0.5 relative z-10">接取任务 · 赚赏金</div>
        </div>
        <div
          onClick={() => navigate('/lost')}
          className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl p-3 text-white relative overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
        >
          <div className="absolute -right-4 -top-5 w-14 h-14 rounded-full bg-white/10" />
          <PackageSearch className="w-6 h-6 mb-1.5 relative z-10" />
          <div className="text-[13px] font-bold relative z-10">失物招领</div>
          <div className="text-[10px] text-white/85 mt-0.5 relative z-10">拾到 · 寻物</div>
        </div>
        <div
          onClick={() => navigate('/beauty')}
          className="bg-gradient-to-br from-pink-600 to-rose-500 rounded-xl p-3 text-white relative overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
        >
          <div className="absolute -right-4 -top-5 w-14 h-14 rounded-full bg-white/10" />
          <Crown className="w-6 h-6 mb-1.5 relative z-10" />
          <div className="text-[13px] font-bold relative z-10">校花校草</div>
          <div className="text-[10px] text-white/85 mt-0.5 relative z-10">投票 · 报名</div>
        </div>
      </div>

      {/* v26：表白墙入口 */}
      <div className="px-4 mb-3">
        <div
          onClick={() => navigate('/wall')}
          className="bg-gradient-to-r from-[#0084FF] to-[#4DA6FF] rounded-xl p-3.5 text-white relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <Heart className="w-7 h-7 fill-current" />
            <div className="flex-1">
              <div className="text-[15px] font-bold">表白墙</div>
              <div className="text-[11px] text-white/85 mt-0.5">发布 ¥1 · 置顶加急 ¥5/天 · 精选免费上墙</div>
            </div>
            <span className="text-[11px] bg-white/20 rounded-full px-3 py-1 shrink-0">去表白 →</span>
          </div>
        </div>
      </div>

      {/* 个性化推荐状态条 */}
      {store.prefs.enablePersonalized && (
        <div className="px-4 mb-2 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Sparkles className="w-3 h-3 text-blue-500" />
          个性化推荐已开启：优先展示本校与关注道人的内容（可在设置中关闭）
        </div>
      )}

      {/* 本校热门（大学/研究生统一推送本校热门） */}
      {schoolFeed.length > 0 && (
        <div className="mb-3">
          <div className="px-4 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              <School className="w-4 h-4 text-emerald-500" />
              {mySchool?.name || ''} · 本校热门
            </div>
            <button onClick={() => navigate(`/topic/school/${mySchool?.id}`)} className="flex items-center text-xs text-gray-400 hover:text-blue-600">
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-4 flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {schoolFeed.map((q: any) => (
              <button
                key={q.id}
                onClick={() => navigate(`/question/${q.id}`)}
                className="shrink-0 w-52 bg-white rounded-xl border border-gray-100 p-3 text-left hover:border-blue-200 transition-colors"
              >
                <div className="text-[13px] font-medium text-gray-800 line-clamp-2 mb-1.5">{q.title}</div>
                <div className="text-[11px] text-gray-400 line-clamp-1 mb-1.5">{q.content}</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span className="text-amber-500 font-medium">热度 {q.hot_score || 0}</span>
                  <span>{q.answer_count || 0} 回答</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 关注动态：关注的人的最新回答 */}
      {followFeed.length > 0 && (
        <div className="mb-3">
          <div className="px-4 mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <Users className="w-4 h-4 text-blue-500" />
            关注动态
          </div>
          <div className="bg-white divide-y divide-gray-50 border-t border-b border-gray-100">
            {followFeed.map((f: any) => (
              <button
                key={f.answer_id}
                onClick={() => navigate(`/question/${f.question_id}`)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="text-[13px] text-gray-800 line-clamp-1 mb-0.5">
                  <span className="text-gray-400 text-xs">{f.author} 回答了</span> {f.q_title}
                </div>
                <div className="text-xs text-gray-500 line-clamp-1">{f.content}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question list - Zhihu style divider cards */}
      {!loaded ? (
        <HomeSkeleton />
      ) : (
        <div className="divide-y divide-gray-100 bg-white border-t border-b border-gray-100">
          {recommended.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <QuestionCard question={q} showHotBadge />
            </motion.div>
          ))}
        </div>
      )}

      {loaded && recommended.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-sm">
          暂无推荐内容，去提一个问题吧~
        </div>
      )}

      {/* 无限滚动：游标分页加载更多 */}
      {loaded && moreAvailable && recommended.length > 0 && (
        <div className="px-4 py-5 flex justify-center">
          <button
            onClick={async () => {
              if (loadingMore) return;
              setLoadingMore(true);
              try {
                const more = await store.loadMoreQuestions();
                setMoreAvailable(more);
              } finally {
                setLoadingMore(false);
              }
            }}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-full bg-white border border-gray-200 text-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
}
