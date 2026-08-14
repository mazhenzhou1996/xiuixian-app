import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Eye, ThumbsUp, School } from 'lucide-react';
import type { IQuestion } from '@/data/types';
import { useXiuxianStore } from '@/store/useStore';
import { formatTime, formatCount, getHotLabel } from '@/utils/format';
import Avatar from '@/components/Avatar';

// v19：学校名模块级缓存（一次查询全站复用，避免每个卡片重复请求）
const schoolNameCache: Record<number, string> = {};
let schoolListLoaded = false;

interface QuestionCardProps {
  question: IQuestion;
  showHotBadge?: boolean;
  rank?: number;
}

export default function QuestionCard({ question, showHotBadge = false, rank }: QuestionCardProps) {
  const navigate = useNavigate();
  const store = useXiuxianStore();
  const hotLabel = getHotLabel(question.hotScore);
  const [schoolName, setSchoolName] = useState<string>(
    (question as any).schoolId ? (schoolNameCache[(question as any).schoolId] || '') : ''
  );

  useEffect(() => {
    const sid = (question as any).schoolId;
    if (!sid) return;
    if (schoolNameCache[sid]) { setSchoolName(schoolNameCache[sid]); return; }
    if (schoolListLoaded) return;
    store.listSchools().then((list: any[]) => {
      schoolListLoaded = true;
      (list || []).forEach((s: any) => { schoolNameCache[s.id] = s.name; });
      if (schoolNameCache[sid]) setSchoolName(schoolNameCache[sid]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(question as any).schoolId]);
  const handleClick = () => {
    navigate(`/question/${question.id}`);
  };

  // 回答摘要（优先显示最高赞回答，无回答时显示问题描述）
  const answers = store.getAnswersByQuestion(question.id);
  const topAnswer = answers.length > 0 ? answers[0] : null;
  const summary = topAnswer?.content || question.content;

  return (
    <div
      onClick={handleClick}
      className="px-4 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
    >
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <div
            className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
              rank === 1
                ? 'bg-blue-600 text-white'
                : rank === 2
                ? 'bg-blue-400 text-white'
                : rank === 3
                ? 'bg-blue-300 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {rank}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-[16px] font-semibold text-gray-900 mb-2 leading-snug line-clamp-2">
            {question.title}
          </h3>

          {/* Author row */}
          <div className="flex items-center gap-2 mb-2">
            <Avatar
              src={(question as any).authorAvatar}
              alt={(question as any).authorName || '道友'}
              className="w-5 h-5"
              bgClass="bg-blue-500"
            />
            <span className="text-xs text-gray-600 truncate">
              {(question as any).authorName || '匿名道友'}
            </span>
            {/* v19：学校标签（点击进学校圈子） */}
            {schoolName && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/topic/school/${(question as any).schoolId}`); }}
                className="shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <School className="w-2.5 h-2.5" />
                {schoolName}
              </button>
            )}
            {showHotBadge && hotLabel.text && (
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${hotLabel.color}`}>
                {hotLabel.text}
              </span>
            )}
          </div>

          {/* Content summary - 部分答案，合理高度 */}
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 mb-2.5">
            {summary}
          </p>

          {/* Bottom meta bar */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" />
              {formatCount(question.viewCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />
              {question.answerCount}
            </span>
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="w-3 h-3" />
              {formatCount(question.likeCount)}
            </span>
            <span className="ml-auto">{formatTime(question.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
