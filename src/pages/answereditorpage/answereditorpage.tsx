import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Image,
  Link as LinkIcon,
  Minus,
  Bold,
  Italic,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';

export default function AnswerEditorPage() {
  usePageTitle('写回答');  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const question = questionId ? store.getQuestionById(questionId) : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (!questionId) return;
    const draft = store.getAnswerDraft(questionId);
    if (draft) setContent(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  useEffect(() => {
    if (!questionId || !content) return;
    const timer = setTimeout(() => {
      store.saveAnswerDraft(questionId, content);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 1500);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, questionId]);

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="写回答" />
        <div className="text-center py-20 text-gray-400 text-sm">问题不存在</div>
      </div>
    );
  }

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const wordCount = content.length;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string].slice(0, 9));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const insertText = (before: string, after = '') => {
    const textarea = document.getElementById(
      'answer-editor',
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      setContent((prev) => prev + before + after);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent =
      content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      const pos = start + before.length + selected.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertLink = () => {
    const url = prompt('请输入链接地址：', 'https://');
    if (url) {
      insertText(`[链接名称](${url})`);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('请输入回答内容');
      return;
    }
    if (content.length < 10) {
      toast.error('回答内容至少10个字');
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await store.addAnswer({
        questionId: question.id,
        userId: currentUser.id,
        content: content.trim(),
        images: images.length > 0 ? images : undefined,
        isAnonymous,
      });
      store.clearAnswerDraft(question.id);
      if (res?.pending) {
        toast.success('匿名回答已提交，审核通过后展示');
      } else {
        toast.success('回答发布成功');
      }
      navigate(`/question/${question.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PageHeader
        title="写回答"
        rightAction={
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-7 px-3 bg-blue-600 text-white text-xs font-medium rounded-full disabled:opacity-50"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        }
      />

      {/* Question context */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="text-xs text-gray-400 mb-1">回答问题</div>
        <h1 className="text-sm font-medium text-gray-800 line-clamp-2">
          {question.title}
        </h1>
      </div>

      {isAnonymous && (
        <div className="bg-purple-50 border-b border-purple-100 px-4 py-2.5 text-xs text-purple-600 leading-relaxed">
          匿名回答将<span className="font-semibold">隐藏你的身份</span>，内容需经后台审核，<span className="font-semibold">审核通过后才会公开显示</span>。
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <textarea
          id="answer-editor"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享你的见解..."
          className="flex-1 w-full px-4 py-4 bg-white text-sm text-gray-700 leading-relaxed outline-none resize-none placeholder-gray-400"
          autoFocus
        />

        {images.length > 0 && (
          <div className="px-4 pb-3 bg-white">
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100">
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
          <ToolButton icon={<Image className="w-4 h-4" />} label="图片" onClick={() => fileInputRef.current?.click()} />
          <ToolButton icon={<LinkIcon className="w-4 h-4" />} label="链接" onClick={insertLink} />
          <ToolButton icon={<Minus className="w-4 h-4" />} label="分割线" onClick={() => insertText('\n---\n')} />
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <ToolButton icon={<Bold className="w-4 h-4" />} label="加粗" onClick={() => insertText('**', '**')} />
          <ToolButton icon={<Italic className="w-4 h-4" />} label="斜体" onClick={() => insertText('*', '*')} />

          <div className="ml-auto flex items-center gap-2 pr-2">
            <button
              onClick={() => setIsAnonymous((v) => !v)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${isAnonymous ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-gray-200 text-gray-500 hover:border-purple-400'}`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{isAnonymous ? '匿名回答' : '匿名'}</span>
            </button>
            {autoSaved && (
              <span className="text-xs text-green-500">已保存草稿</span>
            )}
            <span className="text-xs text-gray-400">{wordCount} 字</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
