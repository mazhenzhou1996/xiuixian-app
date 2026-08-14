import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, History, ArrowLeft, School, Users, GraduationCap, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { REALM_LABELS } from '@/utils/format';
import QuestionCard from '@/components/QuestionCard';
import Avatar from '@/components/Avatar';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function SearchPage() {
  usePageTitle('搜索');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const [keyword, setKeyword] = useState('');
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [siteResults, setSiteResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [uniResults, setUniResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchHistory = store.getSearchHistory();
  const questions = store.getQuestions();

  // 本地兜底：接口不可用时降级为本地过滤（仅覆盖已加载的 50 条）
  const localResults = searched && keyword
    ? questions.filter(
        (q) =>
          q.title.includes(keyword) ||
          q.content.includes(keyword),
      )
    : [];

  const doSearch = useCallback(
    async (kw: string) => {
      const k = kw.trim();
      if (!k) return;
      setKeyword(k);
      setSearched(true);
      store.addSearchHistory(k);
      setSearching(true);
      try {
        // 并行搜：问题 / 用户 / 大学(模糊匹配)
        const [q, u, uni] = await Promise.all([
          store.searchQuestions(k).catch((e) => { console.error('[search] questions:', e?.message || e); return []; }),
          api.searchUsers(k).catch((e) => { console.error('[search] users:', e?.message || e); return []; }),
          api.searchUniversities(k).catch((e) => { console.error('[search] unis:', e?.message || e); return []; }),
        ]);
        setSiteResults(q);
        setUserResults(u);
        setUniResults(uni);
      } catch {
        setSiteResults([]);
        setUserResults([]);
        setUniResults([]);
        toast.error('搜索服务暂不可用，已切换为本地结果');
      } finally {
        setSearching(false);
      }
    },
    [store],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(keyword);
  };

  const handleHistoryClick = (kw: string) => {
    doSearch(kw);
  };

  const clearKeyword = () => {
    setKeyword('');
    setSearched(false);
    setSiteResults([]);
    setUserResults([]);
    setUniResults([]);
    inputRef.current?.focus();
  };

  // 大学 → 专题页(选中该校并跳转)
  const goUniversityTopic = (u: any, topic: 'university' | 'graduate') => {
    store.setSelectedSchool(u);
    navigate(`/topic/${topic}`);
  };

  return (
    <div className="min-h-full">
      {/* 返回栏 */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[720px] mx-auto px-4 flex items-center h-12">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 -ml-2 flex items-center justify-center text-gray-600 hover:text-gray-900"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-gray-800">搜索</h1>
          <div className="w-8" />
        </div>
      </div>
      {/* Search bar */}
      <div className="sticky top-12 z-30 bg-gray-50 px-4 py-2">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索问题 / 道友 / 大学..."
            className="w-full h-10 pl-9 pr-20 bg-white rounded-full text-sm border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          />
          {keyword && (
            <button
              type="button"
              onClick={clearKeyword}
              className="absolute right-14 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 bg-blue-600 text-white text-xs font-medium rounded-full"
          >
            搜索
          </button>
        </form>
      </div>

      <div className="px-4 pb-4 pt-2">
        {/* Before search: show history */}
        {!searched && (
          <div className="space-y-4">
            {searchHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <History className="w-4 h-4 text-gray-400" />
                    <span>搜索历史</span>
                  </div>
                  <button
                    onClick={() => store.clearSearchHistory()}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((h) => (
                    <button
                      key={h}
                      onClick={() => handleHistoryClick(h)}
                      className="px-3 py-1 bg-white text-sm text-gray-600 rounded-full border border-gray-200 hover:border-blue-300"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">热门搜索</div>
              <div className="flex flex-wrap gap-2">
                {['清华大学', '北京大学', '考研', '学霸笔记', '筑基', '元婴', '心魔劫', '功法'].map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => handleHistoryClick(t)}
                      className="px-3 py-1 bg-blue-50 text-sm text-blue-600 rounded-full border border-blue-100"
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search results */}
        {searched && (
          <div className="space-y-4">
            <div className="text-xs text-gray-400 px-1">
              {searching
                ? '正在洞天福地中搜寻...'
                : `找到 ${siteResults.length + userResults.length + uniResults.length} 条相关结果`}
            </div>

            {/* 大学结果(模糊匹配,含双选项卡跳转) */}
            {!searching && uniResults.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  <School className="w-4 h-4 text-blue-600" />
                  <span>大学（{uniResults.length}）</span>
                </div>
                <div className="space-y-2">
                  {uniResults.map((u) => (
                    <div key={u.id} className="bg-white rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">{u.name}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {[u.province, u.city].filter(Boolean).join(' · ') || '—'}
                            {(u.tags || []).length > 0 ? ` · ${(u.tags || []).slice(0, 3).join(' / ')}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => goUniversityTopic(u, 'university')}
                          className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <GraduationCap className="w-3.5 h-3.5" /> 大学专题
                        </button>
                        <button
                          onClick={() => goUniversityTopic(u, 'graduate')}
                          className="flex-1 h-9 rounded-xl bg-violet-600 text-white text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> 研究生专题
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 用户结果 */}
            {!searching && userResults.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <span>道友（{userResults.length}）</span>
                </div>
                <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden">
                  {userResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => navigate(`/user/${u.id}`)}
                      className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Avatar src={u.avatar} alt={u.nickname} className="w-10 h-10" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{u.nickname}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {REALM_LABELS[u.realm as keyof typeof REALM_LABELS] || u.realm || '练气'} · 声望 {u.points || 0}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100 shrink-0">
                        查看主页
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 问题结果 */}
            <div>
              {!searching && (siteResults.length > 0 || localResults.length > 0) && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <span>问题（{(searching ? [] : siteResults.length > 0 ? siteResults : localResults).length}）</span>
                </div>
              )}
              <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
                {(searching ? [] : siteResults.length > 0 ? siteResults : localResults).map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            </div>

            {/* 空结果 */}
            {!searching && siteResults.length === 0 && localResults.length === 0 && userResults.length === 0 && uniResults.length === 0 && (
              <div className="text-center py-20 text-gray-400 text-sm">
                未找到相关内容，换个关键词试试
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
