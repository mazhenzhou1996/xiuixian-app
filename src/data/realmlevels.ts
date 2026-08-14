// 境界等级配置（与数据库 realm_levels 表保持一致）
export interface RealmLevelInfo {
  key: string;
  realm: string;
  stage: string;
  name: string;
  min: number;
}

export const REALM_LEVELS: RealmLevelInfo[] = [
  { key: 'lianqi_early', realm: 'lianqi', stage: 'early', name: '练气初期', min: 0 },
  { key: 'lianqi_mid', realm: 'lianqi', stage: 'mid', name: '练气中期', min: 30 },
  { key: 'lianqi_late', realm: 'lianqi', stage: 'late', name: '练气后期', min: 80 },
  { key: 'zhuji_early', realm: 'zhuji', stage: 'early', name: '筑基初期', min: 150 },
  { key: 'zhuji_mid', realm: 'zhuji', stage: 'mid', name: '筑基中期', min: 300 },
  { key: 'zhuji_late', realm: 'zhuji', stage: 'late', name: '筑基后期', min: 500 },
  { key: 'jiedan_early', realm: 'jiedan', stage: 'early', name: '结丹初期', min: 800 },
  { key: 'jiedan_mid', realm: 'jiedan', stage: 'mid', name: '结丹中期', min: 1200 },
  { key: 'jiedan_late', realm: 'jiedan', stage: 'late', name: '结丹后期', min: 1800 },
  { key: 'yuanying_early', realm: 'yuanying', stage: 'early', name: '元婴初期', min: 2500 },
  { key: 'yuanying_mid', realm: 'yuanying', stage: 'mid', name: '元婴中期', min: 3500 },
  { key: 'yuanying_late', realm: 'yuanying', stage: 'late', name: '元婴后期', min: 5000 },
  { key: 'huashen_early', realm: 'huashen', stage: 'early', name: '化神初期', min: 7000 },
  { key: 'huashen_mid', realm: 'huashen', stage: 'mid', name: '化神中期', min: 10000 },
  { key: 'huashen_late', realm: 'huashen', stage: 'late', name: '化神后期', min: 15000 },
];

// 声望获取规则（与数据库触发器一致）
export const REPUTATION_RULES = [
  { action: '发布问题', points: 10 },
  { action: '发布回答', points: 20 },
  { action: '回答被点赞', points: 5 },
  { action: '问题被收藏', points: 2 },
  { action: '被道友关注', points: 3 },
];

export function getLevelIndex(realm: string, stage: string): number {
  return REALM_LEVELS.findIndex((l) => l.realm === realm && l.stage === (stage || 'early'));
}

export function getCurrentLevel(realm: string, stage: string): RealmLevelInfo | null {
  const i = getLevelIndex(realm, stage);
  return i >= 0 ? REALM_LEVELS[i] : null;
}

export function getNextLevel(realm: string, stage: string): RealmLevelInfo | null {
  const i = getLevelIndex(realm, stage);
  return i >= 0 && i < REALM_LEVELS.length - 1 ? REALM_LEVELS[i + 1] : null;
}

export function getProgress(points: number, realm: string, stage: string): { percent: number; next: RealmLevelInfo | null } {
  const cur = getCurrentLevel(realm, stage);
  const next = getNextLevel(realm, stage);
  if (!cur || !next) return { percent: 100, next: null };
  const range = next.min - cur.min;
  const pct = range <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((points - cur.min) / range) * 100)));
  return { percent: pct, next };
}
