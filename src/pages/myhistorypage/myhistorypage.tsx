import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime } from '@/utils/format';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function MyHistoryPage() {
  usePageTitle('浏览历史');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const history = store.getViewHistory();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="浏览历史"
        rightAction={
          history.length > 0 ? (
            <button
              onClick={() => store.clearViewHistory()}
              className="flex items-center gap-1 text-xs text-gray-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
          ) : undefined
        }
      />
      {history.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          暂无浏览记录
        </div>
      ) : (
        <div className="bg-white divide-y divide-gray-100 border-t border-b border-gray-100">
          {history.map((h) => (
            <div
              key={h.id}
              onClick={() => navigate(`/question/${h.id}`)}
              className="px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm text-gray-800 line-clamp-1 mb-1">
                {h.title}
              </div>
              <div className="text-xs text-gray-400">{formatTime(h.time)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
