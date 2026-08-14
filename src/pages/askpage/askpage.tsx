import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, X, Clock, School, EyeOff, ChevronDown, Check, Coins, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AskPage() {
  usePageTitle('提问');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolKeyword, setSchoolKeyword] = useState('');
  const [schools, setSchools] = useState<any[]>([]);
  // v19：悬赏 + 认证修士推送
  const [bountyAmount, setBountyAmount] = useState(0);
  const [pushVerified, setPushVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.listSchools().then((list: any[]) => setSchools(list || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myQuestions = currentUser
    ? store.getQuestions().filter((q) => q.userId === currentUser.id)
    : [];

  // 真实上传：图片直接进 Supabase Storage，正文存公网 URL（不再用 base64）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= 9) {
          toast.info('最多上传 9 张图片');
          break;
        }
        const url = await api.uploadImage(file);
        setImages((prev) => [...prev, url]);
      }
    } catch (err: any) {
      toast.error(err?.message || '图片上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      toast.info('请先登录');
      navigate('/login');
      return;
    }
    if (!title.trim()) {
      toast.error('请输入问题标题');
      return;
    }
    if (title.length < 5) {
      toast.error('标题至少5个字');
      return;
    }
    if (!content.trim()) {
      toast.error('请输入问题详情');
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const q = await store.addQuestion({
        userId: currentUser.id,
        title: title.trim(),
        content: content.trim(),
        images: images.length > 0 ? images : undefined,
        type: 'normal',
        schoolId: schoolId ?? null,
        isAnonymous,
      });
      if (isAnonymous) {
        toast.success('匿名提问已提交，审核通过后展示');
      } else {
        toast.success('提问成功');
      }
      // v19：提问挂悬赏
      if (bountyAmount > 0 && q?.id) {
        try {
          await api.createBountyForQuestion(Number(q.id), bountyAmount);
          toast.success(`已为问题挂上悬赏 ¥${bountyAmount}，全网道友均可接取`);
        } catch (e: any) {
          toast.error('悬赏挂载失败：' + (e?.message || ''));
        }
      }
      // v19：优先推送本校认证修士
      if (schoolId && pushVerified && q?.id) {
        try {
          const r = await api.inviteVerifiedMembers(Number(q.id), schoolId);
          toast.success(`已推送 ${r?.invited || 0} 位本校认证修士`);
        } catch (e: any) {
          toast.error('推送失败：' + (e?.message || ''));
        }
      }
      navigate(`/question/${q.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || '提问失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSchools = schoolKeyword.trim()
    ? (schools || []).filter((s: any) => s.name.includes(schoolKeyword.trim()))
    : (schools || []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PageHeader
        title="提问"
        rightAction={
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-7 px-4 bg-blue-600 text-white text-xs font-medium rounded-full disabled:opacity-50"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        }
      />

      <div className="flex-1 px-4 py-3 space-y-3">
        {/* Title */}
        <div className="bg-white rounded-xl p-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入问题标题（至少5个字）"
            maxLength={50}
            className="w-full text-base font-medium text-gray-800 placeholder-gray-400 outline-none border-0 bg-transparent"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {title.length}/50
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="详细描述你的问题，有助于道友们给出更准确的回答..."
            rows={8}
            className="w-full text-sm text-gray-700 placeholder-gray-400 outline-none border-0 bg-transparent resize-none leading-relaxed"
          />
          <div className="text-right text-xs text-gray-400 mt-1">
            {content.length} 字
          </div>
        </div>

        {/* Image preview */}
        {images.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-xl p-3 flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            <span>{uploading ? '上传中...' : '图片'}</span>
          </button>

          {/* 学校标签：选择后自动进入该校圈子/本校热门 */}
          <div className="relative flex-1">
            <button
              onClick={() => setSchoolOpen((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${schoolId ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:border-blue-400'}`}
            >
              <School className="w-4 h-4" />
              <span className="max-w-[140px] truncate">{schoolName || '选择学校（可选）'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {schoolId && (
              <button
                onClick={() => { setSchoolId(null); setSchoolName(''); }}
                className="ml-1 text-xs text-gray-400 hover:text-red-500"
              >
                清除
              </button>
            )}
            {schoolOpen && (
              <div className="absolute left-0 top-full mt-1 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 z-30 p-2">
                <input
                  type="text"
                  value={schoolKeyword}
                  onChange={(e) => setSchoolKeyword(e.target.value)}
                  placeholder="搜索学校名称"
                  className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 outline-none mb-1"
                />
                <div className="divide-y divide-gray-50">
                  {(filteredSchools.length > 0 ? filteredSchools : (schools || [])).slice(0, 30).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSchoolId(s.id);
                        setSchoolName(s.name);
                        setSchoolOpen(false);
                        setSchoolKeyword('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-lg flex items-center justify-between"
                    >
                      <span className="truncate">{s.name}</span>
                      {s.id === schoolId && <Check className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))}
                  {(schools || []).length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">加载中...</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 匿名开关：匿名内容需后台审核后展示 */}
          <button
            onClick={() => setIsAnonymous((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${isAnonymous ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-gray-200 text-gray-500 hover:border-purple-400'}`}
          >
            <EyeOff className="w-4 h-4" />
            <span>{isAnonymous ? '匿名提问' : '匿名'}</span>
          </button>
        </div>

        {isAnonymous && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 text-xs text-purple-600 leading-relaxed">
            匿名提问将<span className="font-semibold">隐藏你的身份</span>，内容需经后台审核，<span className="font-semibold">审核通过后才会公开显示</span>。请遵守社区规范，违规内容将被拒绝发布。
          </div>
        )}

        {/* v19：悬赏 + 认证修士推送 */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              设置悬赏（可选）
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={bountyAmount || ''}
                onChange={(e) => setBountyAmount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                min={0}
                max={100}
                placeholder="0 = 不悬赏"
                className="w-28 h-10 rounded-xl bg-gray-50 px-3 text-sm outline-none"
              />
              <span className="text-sm text-gray-400">元</span>
              <span className="text-[11px] text-gray-400 ml-auto">挂上悬赏，全网道友均可接取（余额支付，1-100 元）</span>
            </div>
          </div>
          {schoolId && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-emerald-500" />
                  优先推送给本校认证修士？
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">发布后向「{schoolName}」的认证修士发送回答邀请</div>
              </div>
              <button
                onClick={() => setPushVerified((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${pushVerified ? 'bg-emerald-500' : 'bg-gray-200'}`}
                aria-pressed={pushVerified}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${pushVerified ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          )}
        </div>

        {/* My history questions */}
        {currentUser && myQuestions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>我的提问</span>
            </div>
            <div className="bg-white rounded-xl divide-y divide-gray-50">
              {myQuestions.slice(0, 5).map((q) => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/question/${q.id}`)}
                  className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm text-gray-800 line-clamp-1 mb-1">
                    {q.title}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-3">
                    <span>{formatTime(q.createdAt)}</span>
                    <span>{q.answerCount} 回答</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!currentUser && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-3">登录后才能提问哦</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-blue-600 text-white text-sm rounded-full"
            >
              去登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
