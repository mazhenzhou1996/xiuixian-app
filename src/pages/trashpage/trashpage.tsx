import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useXiuxianStore } from '@/store/useStore';
import { usePageTitle } from '@/hooks/usePageTitle';

const DAY = 24 * 60 * 60 * 1000;

export default function TrashPage() {
  usePageTitle('回收箱');
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const currentUser = store.getCurrentUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    store.getUserMessages(currentUser.id).then(setMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshKey]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="回收箱" />
        <div className="text-center py-20 text-gray-400 text-sm">
          登录后查看回收箱
        </div>
      </div>
    );
  }

  const trashed = store.getTrashedMessages();
  const msgByKey = new Map(messages.map((m) => [String(m.id), m]));
  const list = trashed
    .map((t) => ({ ...t, msg: msgByKey.get(t.key) }))
    .filter((x) => x.msg)
    .sort((a, b) => b.time - a.time);

  const handleRestore = (key: string) => {
    store.restoreMessage(key);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="回收箱" />
      <div className="px-4 py-2">
        <div className="text-xs text-gray-400 px-1 pb-2">
          删除的消息保留 15 天，超期自动清除；可随时恢复。
        </div>
        <div className="bg-white rounded-xl divide-y divide-gray-50 overflow-hidden">
          {list.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-sm">
              回收箱是空的
            </div>
          )}

          {list.map((item) => {
            const msg = item.msg;
            const remainDays = Math.max(0, Math.ceil((15 * DAY - (Date.now() - item.time)) / DAY));
            return (
              <div key={item.key} className="flex items-start gap-3 p-4">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    if (msg.targetId && msg.type !== 'follow') {
                      navigate(`/question/${msg.targetId}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {msg.userName || '系统通知'}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto shrink-0">
                      剩余 {remainDays} 天
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {msg.content}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(item.key)}
                  className="flex items-center gap-1 shrink-0 h-7 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
