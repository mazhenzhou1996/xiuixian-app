import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  showShare?: boolean;
}

/** 分享当前页面：优先 Web Share API，降级为复制链接 */
export async function shareCurrentPage(title?: string): Promise<void> {
  const url = window.location.href;
  const shareTitle = title ? `${title} - 修仙问答` : '修仙问答';
  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, url });
      return;
    } catch (err) {
      // 用户取消分享（AbortError）时静默返回
      if ((err as Error)?.name === 'AbortError') return;
      // 其他错误降级到复制链接
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('链接已复制，快去分享给道友吧');
  } catch {
    toast.info(`请复制链接：${url}`);
  }
}

export default function PageHeader({ title, showBack = true, rightAction, showShare = false }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleShare = () => {
    shareCurrentPage(title);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-[720px] mx-auto px-4 flex items-center h-12">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 -ml-2 flex items-center justify-center text-gray-600 hover:text-gray-900"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-8" />
        )}

        <h1 className="flex-1 text-center text-base font-semibold text-gray-800 truncate">
          {title}
        </h1>

        {rightAction ?? (
          <div className="w-8 flex items-center justify-end">
            {showShare && (
              <button
                onClick={handleShare}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900"
                aria-label="分享"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
