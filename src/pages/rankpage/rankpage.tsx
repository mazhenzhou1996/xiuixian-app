import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { REALM_LABELS, REALM_ORDER, REALM_COLORS, formatCount } from '@/utils/format';
import type { RealmLevel, IUser } from '@/data/types';
import Avatar from '@/components/Avatar';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Seo } from '@/components/Seo';
import { Coins } from 'lucide-react';

export default function RankPage() {
  usePageTitle('排行榜');
  const [activeRealm, setActiveRealm] = useState<RealmLevel>('huashen');
  const [showBounty, setShowBounty] = useState(false);
  const [bountyRank, setBountyRank] = useState<any[]>([]);
  const [rankUsers, setRankUsers] = useState<any[]>([]);

  useEffect(() => {
    if (showBounty) api.getBountyRankings().then(setBountyRank).catch(() => {});
  }, [showBounty]);

  // v16：按境界 RPC 查询（不再前端过滤全量用户，用户量大也不截断）
  useEffect(() => {
    let cancelled = false;
    api.getRankingsByRealm(activeRealm, 50).then((list) => {
      if (!cancelled) setRankUsers(list || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeRealm]);

  const topThree = rankUsers.slice(0, 3);
  const rest = rankUsers.slice(3);

  return (
    <div className="px-4 py-3">
      <Seo
        title="修仙排行榜 - 修仙问答"
        description="修仙修士境界排行与悬赏金榜，看各境界道友的修为积分与贡献。"
        keywords="修仙排行榜,境界榜,悬赏金榜,修为积分"
        type="website"
        canonical="/rank"
      />
      {/* 模式切换:境界榜 / 悬赏金榜 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3">
        <button
          onClick={() => setShowBounty(false)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!showBounty ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          境界榜
        </button>
        <button
          onClick={() => setShowBounty(true)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${showBounty ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          <Coins className="w-3.5 h-3.5" /> 悬赏金榜
        </button>
      </div>

      {/* 悬赏金榜 */}
      {showBounty ? (
        <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-50">
          {bountyRank.length === 0 && (
            <div className="p-12 text-center text-sm text-gray-400">暂无悬赏分红记录</div>
          )}
          {bountyRank.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-3 p-4">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{r.nickname}</div>
              </div>
              <span className="text-sm font-bold text-amber-600 flex items-center gap-1">
                <Coins className="w-4 h-4" /> ¥{r.total_payout}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
      {/* Realm tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3">
        {REALM_ORDER.map((realm) => (
          <button
            key={realm}
            onClick={() => setActiveRealm(realm)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeRealm === realm
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {REALM_LABELS[realm]}
          </button>
        ))}
      </div>

      {/* Podium for top 3 */}
      {topThree.length > 0 && (
        <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl p-5 mb-4 border border-blue-100">
          <div className="flex items-end justify-center gap-4 mb-6">
            {topThree[1] && <PodiumItem user={topThree[1]} rank={2} />}
            {topThree[0] && <PodiumItem user={topThree[0]} rank={1} />}
            {topThree[2] && <PodiumItem user={topThree[2]} rank={3} />}
          </div>
        </div>
      )}

      {/* Rest of list */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
        {rest.map((user, i) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0"
          >
            <div className="w-8 text-center text-sm font-medium text-gray-400">
              {i + 4}
            </div>
            <Avatar
              src={user.avatar}
              alt={user.nickname}
              className="w-10 h-10"
              bgClass="bg-gradient-to-br from-blue-500 to-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 truncate">
                  {user.nickname}
                </span>
                <span
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${REALM_COLORS[user.realm as keyof typeof REALM_COLORS]}`}
                >
                  {REALM_LABELS[user.realm as keyof typeof REALM_LABELS]}
                </span>
              </div>
              {user.bio && (
                <div className="text-xs text-gray-400 truncate mt-0.5">{user.bio}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-600">
                {formatCount(user.points)}
              </div>
              <div className="text-[10px] text-gray-400">声望值</div>
            </div>
          </div>
        ))}
        {rankUsers.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            该境界暂无修士上榜
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function PodiumItem({ user, rank }: { user: IUser; rank: number }) {
  const heights = { 1: 'h-20', 2: 'h-14', 3: 'h-10' };
  const avatarSize = { 1: 'w-16 h-16', 2: 'w-12 h-12', 3: 'w-10 h-10' };
  const bgColor = {
    1: 'bg-gradient-to-t from-blue-500 to-blue-200',
    2: 'bg-gradient-to-t from-blue-400 to-blue-100',
    3: 'bg-gradient-to-t from-blue-300 to-blue-100',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar
        src={user.avatar}
        alt={user.nickname}
        className={`${avatarSize[rank as 1 | 2 | 3]} border-4 ${
          rank === 1 ? 'border-blue-400' : rank === 2 ? 'border-blue-300' : 'border-blue-200'
        } shadow-md`}
        bgClass="bg-gradient-to-br from-blue-500 to-indigo-500"
      />
      <div className="text-xs font-medium text-gray-800 text-center max-w-[80px] truncate">
        {user.nickname}
      </div>
      <div
        className={`${heights[rank as 1 | 2 | 3]} w-16 rounded-t-lg ${bgColor[rank as 1 | 2 | 3]} flex items-start justify-center pt-2 text-lg font-bold text-white`}
      >
        {rank}
      </div>
    </div>
  );
}
