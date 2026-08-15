import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// ===== v11 成本优化：模块级共享缓存 + 请求去重 =====
// 原实现每个组件都 new 一个 store 并各自 fetch，单次首页 366 个 Supabase 请求。
// 现在同 key 请求共享 Promise（并发去重）+ 30 秒 TTL 缓存，全站请求量降一个数量级。
const cache = new Map<string, { data: any; at: number }>();
const TTL = 30_000;
const inflight = new Map<string, Promise<any>>();

function cachedFetch<T>(key: string, fn: () => Promise<T>, ttl = TTL): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((data) => {
      cache.set(key, { data, at: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}

function invalidateCache(prefix: string) {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
function clearAllCache() {
  cache.clear();
  inflight.clear();
}

interface User {
  id: number;
  phone: string;
  nickname: string;
  avatar: string;
  realm: string;
  stage?: string;
  points: number;
  bio: string;
  isAdmin?: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normQ(q: any): any { return { ...q, id: String(q.id), userId: String(q.userId), answerCount: q.answerCount || 0, likeCount: q.likeCount || 0, favoriteCount: q.favoriteCount || 0, createdAt: new Date(q.createdAt).getTime() }; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normA(a: any): any { return { ...a, id: String(a.id), questionId: String(a.questionId), userId: String(a.userId), createdAt: new Date(a.createdAt).getTime() }; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normC(c: any): any { return { ...c, id: String(c.id), answerId: String(c.answerId), userId: String(c.userId), replyTo: c.replyTo ? String(c.replyTo) : undefined, replyToUserId: c.replyToUserId ? String(c.replyToUserId) : undefined, createdAt: new Date(c.createdAt).getTime() }; }

export function useXiuxianStore() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([]);
  // v13 游标分页：首页/热榜无限滚动的下一页游标
  const [questionsCursor, setQuestionsCursor] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionsRef = useRef<any[]>([]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [likes, setLikes] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [favorites, setFavorites] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [answersCache, setAnswersCache] = useState<Record<string, any[]>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [users, setUsers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<{ hideContent: boolean; enablePersonalized: boolean }>({ hideContent: false, enablePersonalized: true });
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      // 登录态统一以 Supabase session 为权威源（persistSession 已自动管理），
      // 不再依赖 localStorage 'token' 旧逻辑，避免双写不一致
      const { data: { session } } = await supabase.auth.getSession();
      try {
        if (session) {
          const me = await cachedFetch('me', () => api.getMe());
          setCurrentUser(me.user);
          setPrefs({ hideContent: !!me.user.hideContent, enablePersonalized: me.user.enablePersonalized !== false });
          const myLikes = await cachedFetch('mylikes', () => api.getMyLikes());
          setLikes(myLikes.map((l: any) => ({ targetType: l.targetType, targetId: String(l.targetId) })));
          const myFavs = await cachedFetch('myfavorites', () => api.getMyFavorites());
          setFavorites(myFavs.map(normQ));
          // 加载关注列表
          const myFollowing = await cachedFetch('myfollowing', () => api.getMyFollowing());
          setFollowingIds(new Set(myFollowing));
        }
      } catch {
        // 登录态加载失败（限流/网络抖动）：3 秒后重试一次
        if (session) {
          setTimeout(async () => {
            try {
              const me = await cachedFetch('me', () => api.getMe());
              setCurrentUser(me.user);
              setPrefs({ hideContent: !!me.user.hideContent, enablePersonalized: me.user.enablePersonalized !== false });
              const myLikes = await cachedFetch('mylikes', () => api.getMyLikes());
              setLikes(myLikes.map((l: any) => ({ targetType: l.targetType, targetId: String(l.targetId) })));
              const myFavs = await cachedFetch('myfavorites', () => api.getMyFavorites());
              setFavorites(myFavs.map(normQ));
              const myFollowing = await cachedFetch('myfollowing', () => api.getMyFollowing());
              setFollowingIds(new Set(myFollowing));
            } catch { /* ignore */ }
          }, 3000);
        }
      }
      try {
        const qs = await cachedFetch('questions:hot', () => api.getQuestions(undefined, { limit: 40 }));
        setQuestions(qs.map(normQ));
      } catch {
        // 网络/限流失败时 3 秒后自动重试一次，避免页面误报“不存在”
        setTimeout(async () => {
          try {
            const qs = await cachedFetch('questions:hot', () => api.getQuestions(undefined, { limit: 40 }));
            setQuestions(qs.map(normQ));
          } catch { /* ignore */ }
        }, 3000);
      }
      try {
        const allUsers = await cachedFetch('allusers', () => api.getAllUsers());
        setUsers(allUsers);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQuestions = useCallback(async () => {
    try {
      invalidateCache('questions:');
      const qs = await cachedFetch('questions:hot', () => api.getQuestions());
      setQuestions(qs.map(normQ));
    } catch { /* ignore */ }
  }, []);

  // ---- Auth ----
  const login = useCallback(async (phone: string, password: string) => {
    const res = await api.login(phone, password);
    clearAllCache();
    setCurrentUser(res.user);
    setPrefs({ hideContent: !!res.user.hideContent, enablePersonalized: res.user.enablePersonalized !== false });
  }, []);

  const register = useCallback(async (email: string, nickname: string, password: string, school?: string) => {
    const res = await api.register(email, nickname, password, school);
    clearAllCache();
    setCurrentUser(res.user);
    setPrefs({ hideContent: !!res.user.hideContent, enablePersonalized: res.user.enablePersonalized !== false });
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch {}
    localStorage.removeItem('token');
    clearAllCache();
    setCurrentUser(null);
    setAnswersCache({});
    setFollowingIds(new Set());
    setLikes([]);
    setFavorites([]);
  }, []);

  // ---- Users ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUsers = useCallback((): any[] => users, [users]);
  const getUserById = useCallback((id: string | number): any => users.find((u: any) => String(u.id) === String(id)) || null, [users]);
  const getCurrentUser = useCallback((): User | null => currentUser, [currentUser]);

  // ---- Questions ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getQuestions = useCallback((): any[] => questions, [questions]);

  const getQuestionById = useCallback((id: string | number): any | undefined =>
    questions.find((q: any) => q.id === String(id)), [questions]);

  // ---- Questions: 游标分页加载更多（无限滚动） ----
  const loadMoreQuestions = useCallback(async (): Promise<boolean> => {
    try {
      let cursor = questionsCursor;
      if (!cursor) {
        const arr = questionsRef.current;
        if (arr.length === 0) return false;
        const last = arr[arr.length - 1];
        cursor = JSON.stringify({ v: last.hotScore, id: Number(last.id) });
      }
      const { items, nextCursor } = await api.getQuestionsCursor({ cursor });
      if (items.length === 0) { setQuestionsCursor(null); return false; }
      const ids = new Set(questionsRef.current.map((q: any) => q.id));
      const merged = [...questionsRef.current, ...items.filter((i: any) => !ids.has(i.id))];
      setQuestions(merged);
      setQuestionsCursor(nextCursor);
      return !!nextCursor;
    } catch { return false; }
  }, [questionsCursor]);

  // ---- 禁言/封禁校验（写操作前调用，受限则抛错） ----
  const assertNotRestricted = useCallback(async () => {
    try {
      const p = await api.getMyPenalty();
      // 无匹配时 RPC 返回全 null 行，需同时判断 type
      if (!p || !p.type) return;
      const until = p.until ? `至 ${new Date(p.until).toLocaleString('zh-CN')}` : null;
      if (p.type === 'mute') {
        const dur = until || (p.duration_hours === 0 ? '（永久）' : `（${p.duration_hours} 小时）`);
        throw new Error(`账号已被禁言${dur}${p.reason ? `：${p.reason}` : ''}`);
      }
      throw new Error(`账号已被封禁${until || '（永久）'}`);
    } catch (e: any) {
      if (e.message && (e.message.includes('禁言') || e.message.includes('封禁'))) throw e;
      // RPC 异常（未登录等）不阻塞
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addQuestion = useCallback(async (data: any) => {
    await assertNotRestricted();
    const q = await api.createQuestion({ title: data.title, content: data.content, type: data.type, images: data.images || [], schoolId: data.schoolId ?? null, isAnonymous: !!data.isAnonymous });
    await refreshQuestions();
    return { ...normQ(q), pending: !!q.pending };
  }, [refreshQuestions, assertNotRestricted]);

  const incrementView = useCallback(async (qid: string | number) => {
    try { await api.getQuestion(String(qid)); } catch { /* ok */ }
  }, []);

  const searchQuestions = useCallback(async (q: string) => {
    const results = await api.search(q);
    return results.map(normQ);
  }, []);

  // ---- Answers ----
  const loadAnswers = useCallback(async (qid: string | number) => {
    const key = String(qid);
    try {
      const answers = await api.getAnswers(key);
      const normalized = answers.map(normA);
      setAnswersCache((prev: Record<string, any[]>) => ({ ...prev, [key]: normalized }));
      return normalized;
    } catch {
      return answersCache[key] || [];
    }
  }, [answersCache]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAnswersByQuestion = useCallback((qid: string | number): any[] => {
    return answersCache[String(qid)] || [];
  }, [answersCache]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAnswers = useCallback((): any[] => {
    return Object.values(answersCache).flat();
  }, [answersCache]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addAnswer = useCallback(async (data: any) => {
    await assertNotRestricted();
    const res = await api.createAnswer(String(data.questionId), data.content, { isAnonymous: !!data.isAnonymous });
    await refreshQuestions();
    // Reload answers
    await loadAnswers(data.questionId);
    return { id: String(res.id || '0'), ...data, likeCount: 0, commentCount: 0, createdAt: Date.now(), pending: !!res.pending };
  }, [refreshQuestions, loadAnswers, assertNotRestricted]);

  // ---- Comments ---- (cached by answerId) ----
  const [commentsCache, setCommentsCache] = useState<Record<string, any[]>>({});

  const getCommentsByAnswer = useCallback((aid: string | number): any[] => {
    return commentsCache[String(aid)] || [];
  }, [commentsCache]);

  const loadComments = useCallback(async (aid: string | number) => {
    const key = String(aid);
    try {
      const comments = await api.getComments(key);
      const normalized = comments.map(normC);
      setCommentsCache((prev: Record<string, any[]>) => ({ ...prev, [key]: normalized }));
      return normalized;
    } catch {
      return commentsCache[key] || [];
    }
  }, [commentsCache]);

  const getComments = useCallback((): any[] => [], []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addComment = useCallback(async (data: any) => {
    await assertNotRestricted();
    const c = await api.createComment(String(data.answerId), {
      content: data.content,
      replyTo: data.replyTo ? String(data.replyTo) : undefined,
      replyToUserId: data.replyToUserId ? String(data.replyToUserId) : undefined,
    });
    return normC(c);
  }, [assertNotRestricted]);

  // ---- Likes ----
  const isLiked = useCallback((_userId: string | number, targetType: string, targetId: number | string): boolean => {
    return likes.some((l: any) => l.targetType === targetType && l.targetId === String(targetId));
  }, [likes]);

  const toggleLike = useCallback(async (_userId: string | number, targetType: string, targetId: number | string): Promise<boolean> => {
    const nid = parseInt(String(targetId), 10);
    const res = await api.toggleLike(targetType, nid);
    if (res.liked) {
      setLikes((prev: any[]) => [...prev, { targetType, targetId: String(targetId) }]);
    } else {
      setLikes((prev: any[]) => prev.filter((l: any) => !(l.targetType === targetType && l.targetId === String(targetId))));
    }
    // 刷新问题列表以更新点赞计数
    if (targetType === 'question') {
      await refreshQuestions();
    }
    // 刷新回答缓存以更新点赞计数
    if (targetType === 'answer') {
      // 找到该回答所属的问题并刷新
      for (const [qid, ans] of Object.entries(answersCache)) {
        if (ans.some((a: any) => a.id === String(targetId))) {
          await loadAnswers(qid);
          break;
        }
      }
    }
    return res.liked;
  }, [refreshQuestions, answersCache, loadAnswers]);

  // ---- Favorites ----
  const isFavorited = useCallback((_userId: string | number, questionId: number | string): boolean => {
    return favorites.some((f: any) => f.id === String(questionId));
  }, [favorites]);

  const toggleFavorite = useCallback(async (_userId: string | number, questionId: number | string): Promise<boolean> => {
    const res = await api.toggleFavorite(parseInt(String(questionId), 10));
    if (res.favorited) {
      const q = questions.find((x: any) => x.id === String(questionId));
      if (q) setFavorites((prev: any[]) => [...prev, q]);
    } else {
      setFavorites((prev: any[]) => prev.filter((f: any) => f.id !== String(questionId)));
    }
    return res.favorited;
  }, [questions]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUserFavorites = useCallback((_userId: string | number): any[] => favorites, [favorites]);

  // ---- Follows ----
  const isFollowing = useCallback((_a: string | number, followingId: string | number): boolean => {
    return followingIds.has(String(followingId));
  }, [followingIds]);

  const toggleFollow = useCallback(async (_a: string | number, followingId: number | string): Promise<boolean> => {
    const res = await api.toggleFollow(String(followingId));
    const fid = String(followingId);
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (res.following) next.add(fid);
      else next.delete(fid);
      return next;
    });
    return res.following;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFollowers = useCallback(async (userId: string | number): Promise<number> => {
    try {
      const stats = await api.getUserStats(String(userId));
      return stats.followerCount;
    } catch { return 0; }
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFollowing = useCallback(async (userId: string | number): Promise<number> => {
    try {
      const stats = await api.getUserStats(String(userId));
      return stats.followingCount;
    } catch { return 0; }
  }, []);
  // 当前用户关注了谁（FollowPage 依赖，原 store 漏导出导致运行时崩溃）
  const getMyFollowing = useCallback(async (): Promise<string[]> => {
    try { return await api.getMyFollowing(); } catch { return []; }
  }, []);

  // ---- Messages ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUserMessages = useCallback(async (_userId: string | number, _type?: string): Promise<any[]> => {
    try {
      return await api.getMessages();
    } catch { return []; }
  }, []);
  const getUnreadCount = useCallback(async (_userId: string | number, _type?: string): Promise<number> => {
    try {
      const msgs = await api.getMessages();
      return msgs.filter((m: any) => !m.read).length;
    } catch { return 0; }
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markAllRead = useCallback(async (_userId: string | number) => {
    try { await api.markAllMessagesRead(); } catch {}
  }, []);

  // ---- Notifications（v13 实时通知） ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getNotifications = useCallback(async (limit = 50, offset = 0): Promise<any[]> => {
    try { return await api.getNotifications(limit, offset); } catch { return []; }
  }, []);
  const getUnreadNotificationCount = useCallback(async (): Promise<number> => {
    try { return await api.getUnreadNotificationCount(); } catch { return 0; }
  }, []);
  const markNotificationRead = useCallback(async (id: string | number) => {
    try { await api.markNotificationRead(id); } catch {}
  }, []);
  const markAllNotificationsRead = useCallback(async () => {
    try { await api.markAllNotificationsRead(); } catch {}
  }, []);

  // ---- User Answers ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userAnswersCache, setUserAnswersCache] = useState<Record<string, any[]>>({});

  const loadUserAnswers = useCallback(async (userId: string | number) => {
    const key = String(userId);
    try {
      const answers = await api.getUserAnswers(String(userId));
      const normalized = answers.map(normA);
      setUserAnswersCache(prev => ({ ...prev, [key]: normalized }));
      return normalized;
    } catch {
      return userAnswersCache[key] || [];
    }
  }, [userAnswersCache]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getUserAnswers = useCallback((userId: string | number): any[] => {
    return userAnswersCache[String(userId)] || [];
  }, [userAnswersCache]);

  // ---- Search ----
  const getSearchHistory = useCallback((): string[] => {
    try { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch { return []; }
  }, []);
  const addSearchHistory = useCallback((keyword: string) => {
    try {
      const h = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const filtered = h.filter((k: string) => k !== keyword);
      filtered.unshift(keyword);
      localStorage.setItem('searchHistory', JSON.stringify(filtered.slice(0, 10)));
    } catch { /* ignore */ }
  }, []);
  const clearSearchHistory = useCallback(() => { localStorage.setItem('searchHistory', '[]'); }, []);

  // ---- Draft ----
  const getAnswerDraft = useCallback((questionId: string | number): string => {
    try {
      const drafts = JSON.parse(localStorage.getItem('answerDrafts') || '{}');
      return drafts[String(questionId)] || '';
    } catch { return ''; }
  }, []);
  const saveAnswerDraft = useCallback((questionId: string | number, content: string) => {
    try {
      const drafts = JSON.parse(localStorage.getItem('answerDrafts') || '{}');
      drafts[String(questionId)] = content;
      localStorage.setItem('answerDrafts', JSON.stringify(drafts));
    } catch { /* ignore */ }
  }, []);
  const clearAnswerDraft = useCallback((questionId: string | number) => {
    try {
      const drafts = JSON.parse(localStorage.getItem('answerDrafts') || '{}');
      delete drafts[String(questionId)];
      localStorage.setItem('answerDrafts', JSON.stringify(drafts));
    } catch { /* ignore */ }
  }, []);

  // ---- 浏览历史 (localStorage) ----
  const getViewHistory = useCallback((): any[] => {
    try { return JSON.parse(localStorage.getItem('viewHistory') || '[]'); } catch { return []; }
  }, []);
  const addViewHistory = useCallback((q: any) => {
    try {
      const h = JSON.parse(localStorage.getItem('viewHistory') || '[]');
      const filtered = h.filter((x: any) => String(x.id) !== String(q.id));
      filtered.unshift({ id: String(q.id), title: q.title, time: Date.now() });
      localStorage.setItem('viewHistory', JSON.stringify(filtered.slice(0, 50)));
    } catch { /* ignore */ }
  }, []);
  const clearViewHistory = useCallback(() => { localStorage.setItem('viewHistory', '[]'); }, []);

  // ---- 我的点赞 - 目标列表 ----
  const getLikedTargets = useCallback((): { targetType: string; targetId: string }[] => likes, [likes]);

  // ---- 关注问题 / 关注回答 (数据库版，替换 localStorage) ----
  const getFollowedQuestions = useCallback(async (): Promise<any[]> => {
    try { return await api.getFollowedQuestions(); } catch { return []; }
  }, []);
  const isQuestionFollowed = useCallback(async (qid: string | number): Promise<boolean> => {
    try { return await api.isQuestionFollowed(qid); } catch { return false; }
  }, []);
  const toggleQuestionFollow = useCallback(async (q: any): Promise<boolean> => {
    return await api.toggleQuestionFollow(q.id, q.answerCount || 0);
  }, []);
  const markQuestionChecked = useCallback(async (qid: string | number, answerCount: number) => {
    try { await api.markQuestionChecked(qid, answerCount); } catch { /* ignore */ }
  }, []);

  // ---- 关注回答 (数据库版，替换 localStorage) ----
  const getFollowedAnswers = useCallback(async (): Promise<any[]> => {
    try { return await api.getFollowedAnswers(); } catch { return []; }
  }, []);
  const isAnswerFollowed = useCallback(async (aid: string | number): Promise<boolean> => {
    try { return await api.isAnswerFollowed(aid); } catch { return false; }
  }, []);
  const toggleAnswerFollow = useCallback(async (a: any): Promise<boolean> => {
    return await api.toggleAnswerFollow(a);
  }, []);
  const markAnswerChecked = useCallback(async (aid: string | number, likeCount: number) => {
    try { await api.markAnswerChecked(aid, likeCount); } catch { /* ignore */ }
  }, []);

  // ---- 关注人动态检查时间 ----
  const getFolloweeCheckTime = useCallback((): number => {
    try { return Number(localStorage.getItem('followeeCheckTime') || 0); } catch { return 0; }
  }, []);
  const markFolloweeChecked = useCallback(() => {
    localStorage.setItem('followeeCheckTime', String(Date.now()));
  }, []);

  // ---- 私信 (数据库版，替换 localStorage 假聊天) ----
  const getPmMessages = useCallback(async (userId: string | number): Promise<any[]> => {
    try { return await api.getPmMessages(String(userId)); } catch { return []; }
  }, []);
  const sendPmMessage = useCallback(async (userId: string | number, content: string, type: 'text' | 'image' | 'video' = 'text') => {
    await assertNotRestricted();
    const msg = await api.sendPmMessage(String(userId), content, type);
    return msg;
  }, [assertNotRestricted]);
  const getPmConversations = useCallback(async (): Promise<any[]> => {
    try { return await api.getPmConversations(); } catch { return []; }
  }, []);

  // ---- 学校选择（大学专题）----
  const getSelectedSchool = useCallback((): any => {
    try { return JSON.parse(localStorage.getItem('selectedSchool') || 'null'); } catch { return null; }
  }, []);
  const setSelectedSchool = useCallback((school: any) => {
    localStorage.setItem('selectedSchool', JSON.stringify(school));
  }, []);

  // ---- 用户设置 (localStorage) ----
  const getSettings = useCallback((): any => {
    try { return JSON.parse(localStorage.getItem('userSettings') || '{}'); } catch { return {}; }
  }, []);
  const setSetting = useCallback((key: string, value: any) => {
    try {
      const s = JSON.parse(localStorage.getItem('userSettings') || '{}');
      s[key] = value;
      localStorage.setItem('userSettings', JSON.stringify(s));
    } catch { /* ignore */ }
  }, []);
  // 图片加载模式: off | blur | normal
  const getImageMode = useCallback((): string => {
    return getSettings().imageMode || 'normal';
  }, [getSettings]);
  const setImageMode = useCallback((mode: string) => {
    setSetting('imageMode', mode);
    // 全局生效：通过 html 属性控制图片显示
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-img-mode', mode);
    }
  }, [setSetting]);
  const applyImageMode = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-img-mode', getImageMode());
    }
  }, [getImageMode]);

  // ---- 消息回收站 (localStorage, 15 天内可恢复) ----
  const getTrashedMessages = useCallback((): { key: string; time: number }[] => {
    try {
      const list = JSON.parse(localStorage.getItem('trashedMessages') || '[]');
      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      // 自动清除超过 15 天的记录
      const valid = list.filter((t: any) => now - Number(t.time) < 15 * DAY);
      if (valid.length !== list.length) {
        localStorage.setItem('trashedMessages', JSON.stringify(valid));
      }
      return valid;
    } catch { return []; }
  }, []);
  const trashMessage = useCallback((key: string) => {
    try {
      const list = JSON.parse(localStorage.getItem('trashedMessages') || '[]');
      if (!list.some((t: any) => t.key === key)) {
        list.push({ key, time: Date.now() });
        localStorage.setItem('trashedMessages', JSON.stringify(list));
      }
    } catch { /* ignore */ }
  }, []);
  const restoreMessage = useCallback((key: string) => {
    try {
      const list = JSON.parse(localStorage.getItem('trashedMessages') || '[]');
      const next = list.filter((t: any) => t.key !== key);
      localStorage.setItem('trashedMessages', JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  return {
    loaded,
    refreshQuestions,
    login, register, logout, getCurrentUser,
    getUsers, getUserById,
    getQuestions, getQuestionById, addQuestion, incrementView, searchQuestions, loadMoreQuestions,
    getAnswers, getAnswersByQuestion, loadAnswers, addAnswer,
    getComments, getCommentsByAnswer, loadComments, addComment,
    isLiked, toggleLike,
    isFavorited, toggleFavorite, getUserFavorites,
    isFollowing, toggleFollow, getFollowers, getFollowing, getMyFollowing,
    getUserMessages, getUnreadCount, markAllRead,
    getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead,
    loadUserAnswers, getUserAnswers,
    getSearchHistory, addSearchHistory, clearSearchHistory,
    getAnswerDraft, saveAnswerDraft, clearAnswerDraft,
    getViewHistory, addViewHistory, clearViewHistory,
    getLikedTargets,
    getTrashedMessages, trashMessage, restoreMessage,
    getSettings, setSetting, getImageMode, setImageMode, applyImageMode,
    getFollowedQuestions, isQuestionFollowed, toggleQuestionFollow, markQuestionChecked,
    getFollowedAnswers, isAnswerFollowed, toggleAnswerFollow, markAnswerChecked,
    getFolloweeCheckTime, markFolloweeChecked,
    getPmMessages, sendPmMessage, getPmConversations,
    getSelectedSchool, setSelectedSchool,
    // ---- v11 新增 ----
    prefs,
    updatePrefs: async (p: { hideContent?: boolean; enablePersonalized?: boolean }) => {
      await api.updatePrefs(p);
      setPrefs(prev => ({ ...prev, ...p }));
      invalidateCache('me');
    },
    listSchools: () => cachedFetch('schools', () => api.listSchools(), 60_000),
    createTip: (answerId: number, amount: number) => api.createTip(answerId, amount),
    getLikers: (type: 'answer' | 'comment', id: number) => api.getLikers(type, id),
    moveFavorite: (questionId: number, folder: string) => api.moveFavorite(questionId, folder),
    getFavoriteFolders: () => api.getFavoriteFolders(),
    getMyFavoritesWithFolder: () => api.getMyFavoritesWithFolder(),
    getFollowFeed: (offset = 0, limit = 20) => api.getFollowFeed(offset, limit),
    getSchoolFeed: (schoolId: number, offset = 0, limit = 20) => api.getSchoolFeed(schoolId, offset, limit),
    getMyEarnings: () => api.getMyEarnings(),
    listAnonymousReviews: (status = 'pending') => api.listAnonymousReviews(status),
    reviewAnonymous: (id: number, approve: boolean, reason = '') => api.reviewAnonymous(id, approve, reason),
    listContentReviews: (status = 'pending') => api.listContentReviews(status),
    reviewContent: (id: number, approve: boolean) => api.reviewContent(id, approve),
    listAutoRules: () => api.listAutoRules(),
    saveAutoRule: (keyword: string, action = 'hidden', enabled = true, id?: number) => api.saveAutoRule(keyword, action, enabled, id),
    deleteAutoRule: (id: number) => api.deleteAutoRule(id),
  };
}
