// EXPORTS: formatTime, formatCount, REALM_LABELS, REALM_COLORS, REALM_ORDER
import { REALM_LABELS, REALM_ORDER } from '@/data/types';
import type { RealmLevel } from '@/data/types';

export { REALM_LABELS, REALM_ORDER };

export const REALM_COLORS: Record<RealmLevel, string> = {
  huashen: 'text-amber-600 bg-amber-100 border-amber-200',
  yuanying: 'text-purple-600 bg-purple-100 border-purple-200',
  jiedan: 'text-blue-600 bg-blue-100 border-blue-200',
  zhuji: 'text-green-600 bg-green-100 border-green-200',
  lianqi: 'text-gray-600 bg-gray-100 border-gray-200',
};

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;

  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

export function formatCount(n: number): string {
  if (n < 10000) return String(n);
  if (n < 100000000) return (n / 10000).toFixed(1) + '万';
  return (n / 100000000).toFixed(1) + '亿';
}

export function getHotLabel(hotScore: number): { text: string; color: string } {
  if (hotScore >= 10000) return { text: '沸', color: 'bg-red-500 text-white' };
  if (hotScore >= 5000) return { text: '热', color: 'bg-orange-500 text-white' };
  if (hotScore >= 1000) return { text: '新', color: 'bg-blue-500 text-white' };
  return { text: '', color: '' };
}
