import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Store, BadgeCheck } from 'lucide-react';
import { trackBoard } from '@/lib/commerce';

/**
 * 私域广告展板（v23 R08）
 * - 官方位（advertiser_type=platform）优先展示
 * - 曝光埋点（view，每槽位每会话一次）+ 点击埋点（click）
 * - 商家位显示店名标识
 */
export default function AdBoard({ boards, campusName }: { boards: any[]; campusName?: string }) {
  const navigate = useNavigate();
  const viewedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    boards.forEach((b: any) => {
      if (!viewedRef.current.has(b.id)) {
        viewedRef.current.add(b.id);
        trackBoard(b.id, 'view');
      }
    });
  }, [boards]);

  if (!boards || boards.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <Megaphone className="w-4 h-4 text-orange-500" />
        {campusName ? `${campusName} · ` : ''}私域广告展板
        <span className="text-[10px] font-normal text-gray-400">平台官方位优先</span>
      </div>
      {boards.map((b: any) => (
        <div
          key={b.id}
          onClick={() => {
            trackBoard(b.id, 'click');
            if (b.link) {
              if (b.link.startsWith('/')) navigate(b.link);
              else window.open(b.link, '_blank');
            }
          }}
          className={`rounded-xl border p-3.5 cursor-pointer transition-all active:scale-[0.99] ${
            b.advertiser_type === 'platform'
              ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:shadow-md hover:shadow-orange-100'
              : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:shadow-md hover:shadow-emerald-100'
          }`}
        >
          <div className="flex items-start gap-3">
            {b.image ? (
              <img src={b.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
            ) : (
              <div className={`w-16 h-16 rounded-lg flex items-center justify-center shrink-0 ${b.advertiser_type === 'platform' ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                {b.advertiser_type === 'platform' ? (
                  <Megaphone className="w-7 h-7 text-orange-500" />
                ) : (
                  <Store className="w-7 h-7 text-emerald-600" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-800 line-clamp-1">{b.title}</span>
                {b.advertiser_type === 'merchant' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-white rounded-full px-1.5 py-0.5 shrink-0">
                    <BadgeCheck className="w-3 h-3" /> {b.merchant_name || '商家'}
                  </span>
                )}
                {b.advertiser_type === 'platform' && (
                  <span className="text-[10px] font-medium text-orange-500 bg-white rounded-full px-1.5 py-0.5 shrink-0">平台官方</span>
                )}
              </div>
              {b.body && <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{b.body}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
