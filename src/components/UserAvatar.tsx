import { REALM_LABELS, REALM_COLORS } from '@/utils/format';
import type { RealmLevel } from '@/data/types';
import { useXiuxianStore } from '@/store/useStore';

interface UserAvatarProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showRealm?: boolean;
  onClick?: () => void;
}

export default function UserAvatar({ userId, size = 'md', showRealm = false, onClick }: UserAvatarProps) {
  const store = useXiuxianStore();
  const user = store.getUserById(userId);

  if (!user) return null;

  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex items-center gap-2" onClick={onClick}>
      <img
        src={user.avatar}
        alt={user.nickname}
        className={`${sizeMap[size]} rounded-full object-cover border-2 border-amber-200 ${
          onClick ? 'cursor-pointer' : ''
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{user.nickname}</div>
        {showRealm && (
          <span
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${REALM_COLORS[user.realm as RealmLevel]}`}
          >
            {REALM_LABELS[user.realm as RealmLevel]}
          </span>
        )}
      </div>
    </div>
  );
}
