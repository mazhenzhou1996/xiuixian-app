import { useState, useEffect, useCallback } from 'react';
import { EyeOff, ShieldCheck, KeySquare, Check, X, Plus, Trash2, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { formatTime } from '@/utils/format';

type Tab = 'anonymous' | 'content' | 'rules';

export default function AdminReviewsPage() {
  usePageTitle('审核中心');
  const store = useXiuxianStore();
  const [tab, setTab] = useState<Tab>('anonymous');

  const [anonList, setAnonList] = useState<any[]>([]);
  const [contentList, setContentList] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});

  const loadAnon = useCallback(async () => {
    setLoading(true);
    try {
      setAnonList(await store.listAnonymousReviews('pending'));
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [store]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      setContentList(await store.listContentReviews('pending'));
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [store]);

  const loadRules = useCallback(async () => {
    try {
      setRules(await store.listAutoRules());
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    }
  }, [store]);

  useEffect(() => {
    if (tab === 'anonymous') loadAnon();
    if (tab === 'content') loadContent();
    if (tab === 'rules') loadRules();
  }, [tab, loadAnon, loadContent, loadRules]);

  const reviewAnon = async (id: number, approve: boolean) => {
    try {
      await store.reviewAnonymous(id, approve, approve ? '' : (rejectReason[id] || ''));
      toast.success(approve ? '已通过，内容公开' : '已拒绝，内容隐藏');
      setRejectReason((prev) => ({ ...prev, [id]: '' }));
      loadAnon();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const reviewContentItem = async (id: number, approve: boolean) => {
    try {
      await store.reviewContent(id, approve);
      toast.success(approve ? '已通过，内容公开' : '已拒绝，内容隐藏');
      loadContent();
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  const addRule = async () => {
    if (!keyword.trim()) {
      toast.error('请输入关键词');
      return;
    }
    try {
      await store.saveAutoRule(keyword.trim(), 'hidden', true);
      setKeyword('');
      toast.success('规则已添加');
      loadRules();
    } catch (e: any) {
      toast.error(e?.message || '添加失败');
    }
  };

  const removeRule = async (id: number) => {
    try {
      await store.deleteAutoRule(id);
      toast.success('规则已删除');
      loadRules();
    } catch (e: any) {
      toast.error(e?.message || '删除失败');
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'anonymous', label: `匿名审核${anonList.length > 0 ? ` (${anonList.length})` : ''}`, icon: EyeOff },
    { key: 'content', label: `自动审核复核${contentList.length > 0 ? ` (${contentList.length})` : ''}`, icon: ShieldCheck },
    { key: 'rules', label: '关键词规则', icon: KeySquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <PageHeader title="审核中心" />

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 匿名审核队列 */}
      {tab === 'anonymous' && (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">匿名提问/回答需人工审核，通过后公开，拒绝后隐藏（可恢复）</p>
            <button onClick={loadAnon} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : anonList.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">暂无待审核的匿名内容 ✅</div>
          ) : (
            anonList.map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.target_type === 'question' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {r.target_type === 'question' ? '匿名提问' : '匿名回答'}
                  </span>
                  <span className="text-xs text-gray-400">{r.user_nickname || '未知用户'}</span>
                  <span className="text-xs text-gray-300 ml-auto">{formatTime(r.created_at)}</span>
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-line mb-3 line-clamp-4">{r.content_preview}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewAnon(r.id, true)}
                    className="flex-1 h-9 rounded-full bg-green-500 text-white text-xs font-medium hover:bg-green-600 flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> 通过并公开
                  </button>
                  <button
                    onClick={() => reviewAnon(r.id, false)}
                    className="flex-1 h-9 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> 拒绝
                  </button>
                </div>
                <input
                  type="text"
                  value={rejectReason[r.id] || ''}
                  onChange={(e) => setRejectReason((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="拒绝原因（可选，便于作者改进）"
                  className="mt-2 w-full h-8 rounded-lg bg-gray-50 px-3 text-xs outline-none"
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* 自动审核复核队列 */}
      {tab === 'content' && (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">命中关键词的内容已自动隐藏，人工复核后决定公开或保持隐藏</p>
            <button onClick={loadContent} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : contentList.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">暂无待复核内容 ✅</div>
          ) : (
            contentList.map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                    {r.target_type === 'question' ? '问题' : '回答'}
                  </span>
                  <span className="text-xs text-red-500 font-medium">命中关键词：{r.matched_keyword}</span>
                  <span className="text-xs text-gray-300 ml-auto">{formatTime(r.created_at)}</span>
                </div>
                <div className="text-sm text-gray-800 mb-3 line-clamp-3">{r.content_preview}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewContentItem(r.id, true)}
                    className="flex-1 h-9 rounded-full bg-green-500 text-white text-xs font-medium hover:bg-green-600"
                  >
                    放行公开
                  </button>
                  <button
                    onClick={() => reviewContentItem(r.id, false)}
                    className="flex-1 h-9 rounded-full bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300"
                  >
                    保持隐藏
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 关键词规则管理 */}
      {tab === 'rules' && (
        <div className="px-4 py-3 space-y-3">
          <div className="bg-white rounded-xl p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">添加关键词规则</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="输入敏感词，命中后内容自动隐藏并进入复核队列"
                className="flex-1 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
              />
              <button
                onClick={addRule}
                className="shrink-0 h-10 px-4 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> 添加
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl divide-y divide-gray-50">
            {rules.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">暂无规则</div>
            )}
            {rules.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-2">
                <span className="text-sm text-gray-800 flex-1">{r.keyword}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                  {r.action === 'hidden' ? '自动隐藏' : '自动举报'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {r.enabled ? '启用' : '停用'}
                </span>
                <button
                  onClick={() => removeRule(r.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  aria-label="删除规则"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-600 leading-relaxed">
            提示：正式上线前建议接入阿里云/腾讯云内容安全 API（文本+图片），本关键词库作为本地兜底。接入方式见开发文档。
          </div>
        </div>
      )}
    </div>
  );
}
