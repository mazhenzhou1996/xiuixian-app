// EXPORTS: RealmLevel, IUser, IQuestion, IAnswer, IComment, IFavorite, IFollow, ILike, IMessage

export type RealmLevel = 'huashen' | 'yuanying' | 'jiedan' | 'zhuji' | 'lianqi';

export const REALM_LABELS: Record<RealmLevel, string> = {
  huashen: '化神境',
  yuanying: '元婴境',
  jiedan: '结丹境',
  zhuji: '筑基境',
  lianqi: '练气境',
};

export const REALM_ORDER: RealmLevel[] = ['huashen', 'yuanying', 'jiedan', 'zhuji', 'lianqi'];

export interface IUser {
  id: string;
  phone: string;
  nickname: string;
  password: string;
  avatar: string;
  realm: RealmLevel;
  points: number;
  bio?: string;
  createdAt: number;
  source?: 'mock' | 'user';
}

export interface IQuestion {
  id: string;
  userId: string;
  title: string;
  content: string;
  images?: string[];
  type: 'normal' | 'paid';
  viewCount: number;
  answerCount: number;
  likeCount: number;
  favoriteCount: number;
  hotScore: number;
  createdAt: number;
  source?: 'mock' | 'user';
}

export interface IAnswer {
  id: string;
  questionId: string;
  userId: string;
  content: string;
  images?: string[];
  likeCount: number;
  commentCount: number;
  createdAt: number;
  source?: 'mock' | 'user';
}

export interface IComment {
  id: string;
  answerId: string;
  userId: string;
  content: string;
  replyTo?: string;
  replyToUserId?: string;
  likeCount: number;
  createdAt: number;
  source?: 'mock' | 'user';
}

export interface IFavorite {
  id: string;
  userId: string;
  questionId: string;
  createdAt: number;
}

export interface IFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: number;
}

export interface ILike {
  id: string;
  userId: string;
  targetType: 'question' | 'answer' | 'comment';
  targetId: string;
  createdAt: number;
}

export type MessageType = 'comment' | 'like' | 'favorite' | 'follow' | 'official' | 'invite';

export interface IMessage {
  id: string;
  userId: string;
  type: MessageType;
  title: string;
  content: string;
  fromUserId?: string;
  targetType?: string;
  targetId?: string;
  isRead: boolean;
  createdAt: number;
  source?: 'mock' | 'system';
}
